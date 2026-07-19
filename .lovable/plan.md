
# Actual-Fare Trip Tracking & Post-Ride Reconciliation

Add real trip tracking on top of the existing request → approve → deposit workflow. The customer pays an **Estimated Fare** at approval time; when the driver ends the trip, the backend calculates a **Final Fare** from actual GPS mileage, actual driving time, and billable waiting time, then charges or refunds the difference on the saved Stripe payment method.

This is layered on the current codebase — no rebuild. One driver, one Honda CR-V, unchanged.

---

## 1. Database (single migration)

**Extend `bookings`** with:
- Estimates: `estimated_distance_miles`, `estimated_duration_minutes`, `estimated_fare` (rename/mirror existing `amount_paid` as `amount_already_paid`).
- Actuals: `actual_distance_miles`, `actual_duration_minutes`, `pickup_waiting_minutes`, `stop_waiting_minutes`, `free_waiting_minutes`, `billable_waiting_minutes`, `driver_delay_minutes`.
- Timestamps: `trip_started_at`, `trip_ended_at`, `waiting_started_at`, `waiting_ended_at`, `driver_en_route_at`, `driver_arrived_at`, `passenger_picked_up_at`.
- Fare pieces: `toll_amount`, `parking_amount`, `extra_stops_amount`, `final_fare`, `remaining_balance`, `fare_adjustment_percentage`, `final_charge_status` (`pending|charged|refunded|balance_due|approval_required|failed`).
- Consent: `customer_fare_policy_accepted_at`.
- Stripe: `stripe_customer_id`, `stripe_payment_method_id`, `save_payment_method_consent_at`.
- Tracking: `gps_tracking_status` (`idle|active|paused|ended`), `gps_route_encoded` (Google encoded polyline), `gps_start_lat/lng`, `gps_end_lat/lng`.

**New `trip_location_points` table**: `id, booking_id, latitude, longitude, accuracy, recorded_at, trip_status`. RLS: driver (admin) inserts/reads own trips; customer reads only their own booking's points (or none — kept server-side only). Indexed by `(booking_id, recorded_at)`.

**New `booking_audit_log` table**: `id, booking_id, admin_id, field, old_value, new_value, reason, created_at`. Admin-only.

**Extend `admin_settings`** with waiting/fare-cap fields:
- `waiting_charges_enabled` (default true)
- `pickup_free_wait_minutes` (default 5)
- `pickup_wait_rate_per_minute` (default 0.50)
- `stop_free_wait_minutes` (default 3)
- `stop_wait_rate_per_minute` (default 0.50)
- `max_waiting_charge` (default 40)
- `charge_trip_duration` (bool, default true)
- `charge_waiting_time` (bool, default true)
- `max_auto_fare_increase_pct` (default 20)
- `overpay_refund_mode` (`refund|credit`, default `refund`)

GRANTs and RLS follow existing pattern.

---

## 2. Server functions

**`booking-customer.functions.ts`**
- `requestBooking` (existing): also stores `estimated_distance_miles`, `estimated_duration_minutes`, `estimated_fare`, `customer_fare_policy_accepted_at`. Reject if consent not passed.
- `editBooking` (existing): re-runs `computeQuote` on the new pickup/destination/stops and overwrites the stored estimate + route. Returns the new quote so the UI can show new price, new distance, new duration.
- `reportFareIssue(bookingId, message)` (new): stores a complaint row (in `booking_audit_log` with `field='customer_report'`).

**`driver.functions.ts`** — new/extended actions (admin-only):
- `startDrivingToPickup(bookingId)` → sets `driver_en_route_at`, status `driver_en_route`.
- `driverArrived(bookingId)` → sets `driver_arrived_at`, status `driver_arrived`, starts pickup wait clock.
- `startWaiting` / `stopWaiting` (idempotent, sums into `pickup_waiting_minutes` or `stop_waiting_minutes` depending on current status).
- `passengerPickedUp(bookingId)` → sets `passenger_picked_up_at`, stops pickup wait clock.
- `startTrip(bookingId)` → sets `trip_started_at`, `gps_tracking_status='active'`.
- `pauseTrip` / `resumeTrip` → toggles `gps_tracking_status` between `active` and `paused`. Points recorded while paused are dropped server-side.
- `addStop(bookingId)` → records a stop wait window.
- `endTrip(bookingId, { finalTollAmount?, finalParkingAmount? })`:
  1. Sets `trip_ended_at`, `gps_tracking_status='ended'`.
  2. Loads all `trip_location_points` for this booking with `trip_status='active'`, ordered by `recorded_at`.
  3. Filters: drop points with `accuracy > 50m`, drop points closer than 5s to previous, drop implausible jumps (speed > 120 mph over segment).
  4. Batches remaining points and calls Google Maps **Roads API `snapToRoads`** (max 100 per call) through the connector gateway. Concatenates snapped segments.
  5. Computes actual miles = sum of haversine over snapped points. Computes actual duration = last − first snapped timestamp minus paused windows.
  6. Encodes snapped path (polyline) into `gps_route_encoded`.
  7. Computes final fare (see formula), writes all `final_*` fields.
  8. Calls `reconcilePayment(bookingId)`.
- `adminOverrideBooking(bookingId, patch, reason)`: writes to `booking_audit_log` per field before applying.

**`tracking.functions.ts`** (new): `recordLocation(bookingId, { lat, lng, accuracy, recordedAt })`. Auth via `requireSupabaseAuth`, requires admin role, requires booking's `gps_tracking_status='active'`. Inserts into `trip_location_points`. Rate-limited to 1/sec per booking via a UNIQUE(booking_id, recorded_at truncated to second).

**`payment.functions.ts`** — new/extended:
- `approveBooking` (existing): create Stripe Checkout with `payment_intent_data.setup_future_usage='off_session'` **only if** `save_payment_method_consent_at` is set on the booking. Store `stripe_customer_id`, `stripe_payment_method_id` from the resulting session webhook.
- `reconcilePayment(bookingId)`:
  - `diff = final_fare - amount_already_paid`.
  - If `diff <= 0`: refund `|diff|` via Stripe refunds API (or issue credit per setting). Set `final_charge_status='refunded'`, `remaining_balance=0`.
  - If `diff > 0` and `(diff / estimated_fare) * 100 <= max_auto_fare_increase_pct`:
    - Requires saved payment method. Create off-session PaymentIntent on saved `stripe_payment_method_id`. On success → `final_charge_status='charged'`. On failure → `balance_due` and generate a Stripe Checkout link (via existing checkout flow) surfaced on the customer's dashboard/receipt.
  - If `diff > 0` and above threshold: `final_charge_status='approval_required'`. Create a pending charge record; customer sees "Approve additional charge" on dashboard/receipt page.
- `approveAdditionalCharge(bookingId)` (customer-facing): completes the off-session charge.

Webhook (`/api/public/payments/webhook.ts`): on `checkout.session.completed`, also capture `customer` and `payment_intent.payment_method` and save to booking when `save_payment_method_consent_at` is set.

---

## 3. Frontend

**`/book`** (`src/routes/book.tsx`):
- Rename summary total from "Total" to **"Estimated Fare"**.
- Add required checkbox: *"I understand the final fare may change based on actual mileage, actual trip duration, waiting time, tolls, parking, additional stops, destination changes, and other customer-requested changes."* Blocks submit until checked; passed as `customerFarePolicyAccepted`.
- Add optional checkbox: *"Save my card on file for final-trip adjustments (recommended)."* Passed as `savePaymentMethodConsent`.

**Passenger dashboard** (`src/routes/_authenticated/dashboard.tsx`):
- Existing edit action already re-quotes on save — surface the new mileage, new duration, and new estimated fare in the edit dialog before confirm.
- New card variant for `trip_status='completed'`:
  - "Ride completed" with itemized breakdown: estimated vs actual miles, estimated vs actual duration, free vs billable waiting minutes, tolls, parking, amount already paid, remaining charged/refunded, final total, `final_charge_status`.
  - "Report a fare issue" button → modal calling `reportFareIssue`.
  - "Approve additional charge" button when `final_charge_status='approval_required'`.
  - "Pay balance" link when `final_charge_status='balance_due'`.
- Countdown/edit/cancel behavior kept from previous work.

**Driver Dashboard** (`src/routes/_authenticated/admin/driver.tsx`):
- Replace the current fixed status buttons with a state-machine of controls: **Start Driving to Pickup → Driver Arrived → Start/Stop Waiting → Passenger Picked Up → Start Trip → Pause/Resume/Add Stop → End Trip**. Only the valid next actions are enabled.
- On **Start Trip**: browser requests `navigator.geolocation.watchPosition({ enableHighAccuracy: true })`. Every emission is sent to `recordLocation` (client-side dedup: skip if <5s or <5m from last). If permission denied or `watchPosition` errors, show a red banner and pause tracking.
- Wake Lock API (`navigator.wakeLock.request('screen')`) requested on Start Trip to keep the phone awake when supported; released on End/Pause. Explicit note that background tracking with a locked phone is only supported when the OS keeps the tab alive — banner if the page becomes hidden for >30s.
- On **End Trip**: opens a **Final Fare Review** sheet with actual miles, actual duration, waiting breakdown, editable Tolls and Parking, and computed Final Fare. Confirm → calls `endTrip` which reconciles the payment.
- All fare math shown here is fetched from the server, not computed in the browser.

**Booking success / receipt** (`src/routes/booking.success.tsx`): after completion, becomes the itemized receipt page (same content as the dashboard's completed card) with "Report a fare issue".

---

## 4. Roads API integration

Reuse the existing Google Maps connector gateway. `snapToRoads` endpoint: `POST /roads/v1/snapToRoads` with `path=lat,lng|lat,lng|...&interpolate=true`. Called only from `endTrip` in a server function, batched to 100 points. Failures surface a warning on the driver's final-fare review; fall back to raw haversine mileage with a flag.

---

## 5. Security

- All fare math is server-side. Browser sends only raw GPS points and driver actions.
- `recordLocation` requires admin role and matches the booking's driver (single driver — role check is enough).
- Customers cannot write to any tracking or fare field.
- Every admin override writes an audit row before the update. Admin override UI only appears on `/admin/bookings`.
- Stripe Customer/PaymentMethod IDs are stored, never raw card data.
- Automatic charges above `max_auto_fare_increase_pct` require customer approval.

---

## Test plan

1. As customer: request a ride, accept the fare-adjustment policy, admin approves, pay estimated fare with `4242 4242 4242 4242`.
2. As admin on `/admin/driver` (mobile viewport): step through the state machine, grant location permission, drive a short route (or spoof coordinates in devtools), press End Trip.
3. Verify: `trip_location_points` populated; `endTrip` returns final fare; if within 20% and consent given, remaining charged automatically; if above, dashboard shows "Approve additional charge".
4. Repeat with the final fare lower than paid → refund issued.
5. As customer: edit an approved-pending ride's destination — new distance, new duration, new estimated fare shown before save; final saved values reflect the new quote.
6. As customer: after completion, dashboard shows itemized receipt with actual vs estimated columns; "Report a fare issue" writes an audit row.

## Scope note

This is large. I'll implement it in one pass in this order to keep the app functional at every step: migration → server functions (tracking, fare, reconcile) → driver dashboard state machine + GPS → passenger dashboard receipt + edit re-quote surface → booking page consent → Stripe reconciliation. GPS/Wake-Lock behavior on a fully-locked phone is a best-effort browser capability; a native app would be the only way to guarantee it, and that's out of scope here.
