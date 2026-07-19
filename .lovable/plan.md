
# Trip tracking & final-fare reconciliation

Deliver the "actual fare" system in **3 phases** so each part is testable before the next. Every fare calculation stays on the server, the passenger is never charged more than 20% over estimate without their approval, and the design stays for one driver + one Honda CR-V.

## Phase 1 — Fare-estimate transparency & better editing

Small, low-risk UX changes plus one migration. Ship first.

- **DB migration** — extend `admin_settings` (waiting rates, max auto increase %, waiting toggles, allow off-session charges) and `bookings` (estimate snapshots, `actual_distance_miles`, `actual_duration_minutes`, `pickup_waiting_minutes`, `stop_waiting_minutes`, `billable_waiting_minutes`, `driver_delay_minutes`, `trip_started_at`, `trip_ended_at`, `waiting_started_at`, `gps_tracking_status`, `toll_amount`, `parking_amount`, `estimated_fare`, `final_fare`, `remaining_balance`, `fare_adjustment_percentage`, `customer_fare_policy_accepted_at`, `final_charge_status`). Create `trip_location_points` and `booking_audit_log` tables with RLS.
- **`/book`** — rename to "Estimated Fare", add the fare-adjustment disclaimer, require a "I accept the fare-adjustment policy" checkbox; store acceptance timestamp on the booking.
- **`updateMyBooking`** — return the full recomputed quote (miles, minutes, breakdown) instead of just the total.
- **Edit modal** — live re-quote as pickup / destination / stops change, show new distance / travel time / total before saving.
- **Dashboard completed rides** — itemized receipt card: estimated vs actual mileage & time, billable waiting, tolls, parking, amount already paid, refund or balance-due, final total.

## Phase 2 — Driver trip tracker + actual fare

- **New server fns** in `src/lib/trip-tracking.functions.ts`:
  `startDrivingToPickup`, `driverArrived`, `startWaiting`, `stopWaiting`, `startTrip`, `pauseTrip`, `resumeTrip`, `endTrip`, `recordLocationBatch`, `setDriverDelayMinutes`, `addManualFee` (tolls / parking / stop).
- **`endTrip`** on the server:
  1. Snap GPS batch to roads via `roads.googleapis.com/v1/snapToRoads` through the Maps connector gateway. Sum snapped segment distances for `actual_distance_miles`.
  2. `actual_duration_minutes = (trip_ended_at − trip_started_at) − paused_minutes − driver_delay_minutes`.
  3. `billable_waiting_minutes = max(0, pickup_waiting + stop_waiting − free_waiting_minutes)`.
  4. `final_fare = base + actual_miles*per_mile + billable_trip_min*per_min + billable_wait_min*wait_rate + tolls + parking + stops + surcharges − discounts − amount_paid` (server-side only, capped at `max_waiting_charge`).
  5. Compute `fare_adjustment_percentage` vs `estimated_fare` and set `remaining_balance`.
- **Driver dashboard** — add the state-machine buttons (Drive to Pickup → Arrived → Waiting → Picked Up → Start Trip → Pause / Resume → End Trip). Background `watchPosition` loop batches `{ lat, lng, accuracy, recorded_at }` every 5–10 s while status is `picked_up` or `trip_in_progress`, POSTing through `recordLocationBatch`. Wake-Lock API kept awake during active trip. Warn on permission loss.
- **Final-fare review screen** for the driver before pressing "Confirm & charge".

## Phase 3 — Payment reconciliation & customer protection

- On approve, save the Stripe **customer** + `PaymentMethod` from the Checkout session; set `setup_future_usage: 'off_session'` and store consent flag on the booking.
- After `endTrip` + driver confirmation:
  - `remaining_balance <= 0` → auto-refund the overpayment via `stripe.refunds.create`.
  - `0 < adjustment_percentage <= max_auto_increase (default 20%)` → off-session `PaymentIntent` on the saved method; on failure set `final_charge_status = 'balance_due'` and email a hosted-invoice link.
  - `adjustment_percentage > max_auto_increase` → skip auto charge, create a hosted invoice, mark `balance_due`, notify admin, expose "Approve final fare" button on customer dashboard.
- **Customer dashboard** — receipt view with the "Report fare issue" button; itemized breakdown shows amount already paid, remaining charged, final total.
- **Admin overrides** — every manual change to tracked mileage, minutes, waiting, tolls, or final fare writes an entry into `booking_audit_log { old, new, reason, admin_id, at }`.

## Security guarantees

- Fare math is executed only inside server functions; RLS keeps clients from writing `actual_*` or fare columns.
- Roads API + Maps gateway calls stay server-side.
- Off-session charges require the customer's earlier acceptance of the fare-adjustment policy.
- Every automatic charge is capped at `max_automatic_fare_increase`.

## Approval

Reply **"go phase 1"** to start with the migration + booking UX + edit modal changes. I'll pause after Phase 1 so you can smoke-test before I move to the driver tracker.
