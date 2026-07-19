# Implementation Plan — Stevie Services Gap Fixes

## Phase 1 — Critical fixes (booking pipeline)

**1.1 Link bookings to authenticated users**
- `createBookingCheckout` reads the JWT via `requireSupabaseAuth` middleware (attached optionally so guests still work) and sets `user_id` on the booking insert. Also mirrors `userId` onto the Stripe Customer via `resolveOrCreateCustomer` so future dashboard/portal lookups work.

**1.2 Verify payment on the success page**
- Add a server fn `getBookingStatus(booking_id)` that checks the DB (post-webhook). Success page polls briefly (up to ~6s) until `payment_status='paid'`, then shows confirmation. Handles the race where the user lands before the webhook fires.

**1.3 Booking holds / abandoned slot cleanup**
- On checkout session creation, insert a `booking_holds` row with `expires_at = now() + 30 min`.
- Update `check_booking_overlap` trigger to skip `pending_approval` bookings whose `created_at` is older than 30 min and are still `unpaid` (treat as abandoned). Simpler: add a scheduled `pg_cron`-free cleanup at read time — a SQL function called by admin dashboard load that cancels stale unpaid pending bookings.

**1.4 Lock down `admin_settings` public read**
- Replace the wide `admin_settings_read_public` policy with a `public_pricing` **view** that projects only fare-relevant columns (base_fare, per_mile_rate, per_minute_rate, booking_fee, airport_surcharge, stop_fee) and grant SELECT on the view to `anon`. Revoke public SELECT on the table.

**1.5 Close first-user-is-admin bootstrap footgun**
- Update `handle_new_user` to only auto-grant admin when the `user_roles` table is completely empty AND `profiles` is empty (fresh install). After first signup, all future signups are `customer` even if the admin row is later deleted.

## Phase 2 — Approval-mode toggle

**2.1 Wire `admin_settings.require_approval`**
- `createBookingCheckout` reads `require_approval`:
  - `false` → status `pending_approval` at insert, webhook flips to `confirmed` on payment (today's behavior).
  - `true` → status stays `pending_approval` after payment; admin must explicitly confirm.
- Webhook sets `payment_status='paid'` always; only sets `trip_status='confirmed'` when `require_approval=false`.

## Phase 3 — Admin dashboard `/admin`

New route group `src/routes/_authenticated/admin/` with an admin-role guard that redirects non-admins to `/dashboard`.

**3.1 `/admin` (index)** — Revenue cards
- Today / week / month gross revenue, ride count, avg fare, pending-approval count.
- Powered by a new server fn `getAdminStats` (RLS-safe: verifies admin via `has_role`, then reads via `context.supabase`).

**3.2 `/admin/bookings`** — Bookings table
- List with filters (status, date range, search by reservation number/customer name).
- Row actions to transition status: Approve, Start (en_route), Arrived, Picked up, Complete, Cancel.
- Server fn `updateBookingStatus(booking_id, new_status)` with server-side transition validation.
- On `completed` transition: insert a `revenue_records` row (idempotent).

**3.3 `/admin/calendar`** — Week/month calendar
- FullCalendar-style visual grid of confirmed bookings from `pickup_at` to `estimated_end_at`.
- Uses a lightweight in-house grid (no new heavy dep) — 7-day view + month view toggle.

**3.4 `/admin/settings`** — Pricing & approval editor
- Form to edit all `admin_settings` fields: rates, deposit, approval mode, SMS toggles, calendar id.
- Server fn `updateAdminSettings(patch)` (admin-only).

## Phase 4 — Google Calendar auto-sync

- Uses the standard `google_calendar` App connector (developer's own calendar — you as the single driver).
- Link connector via `standard_connectors--connect`.
- Server helper `syncBookingToCalendar(booking_id)`:
  - On `trip_status='confirmed'`: creates a calendar event with pickup + destination + reservation number; stores event id in `bookings.google_calendar_event_id`.
  - On `trip_status='canceled'`: deletes the event.
  - Uses `admin_settings.google_calendar_id` (defaults to `primary`).
- Called from the webhook (after auto-confirm) and from `updateBookingStatus` transitions.

## Phase 5 — Customer reviews

**5.1 Submission**
- New route `/_authenticated/dashboard/review/$bookingId` (or inline card on dashboard for completed rides missing a review).
- 1–5 stars + optional comment. RLS already enforces `booking.user_id = auth.uid()` and `trip_status='completed'`.

**5.2 Admin moderation**
- `/admin/reviews` — list pending reviews, buttons to approve / hide / respond.
- Server fn `moderateReview(review_id, action, admin_response?)`.

**5.3 Homepage display**
- Public server fn `getApprovedReviews(limit)` using the server publishable client + narrow `TO anon` SELECT policy that already exists (`customer_reviews.is_approved = true`).
- Replaces the static testimonials on `/` with real approved reviews (falls back to static if none yet).

## Technical notes

- Migrations required for: (a) `public_pricing` view + policy swap, (b) `handle_new_user` update, (c) status transition CHECK function.
- No new heavy npm deps — reuse existing. Calendar grid built with Tailwind + date-fns (already installed).
- All admin server fns follow the pattern: `requireSupabaseAuth` → verify `has_role(userId, 'admin')` via `context.supabase` → then use `supabaseAdmin` for writes when RLS would otherwise block cross-user reads/writes.
- Google Calendar calls go through the connector gateway URL `https://connector-gateway.lovable.dev/google_calendar/calendar/v3` with `Authorization: Bearer $LOVABLE_API_KEY` + `X-Connection-Api-Key: $GOOGLE_CALENDAR_API_KEY`.

## Testing plan (once implemented)

**Booking → payment (happy path)**
1. Sign out. Go to `/book`, fill in pickup + drop-off (try "LGA" → "Times Square"). Confirm live quote appears.
2. Click Continue to Payment. In the embedded Stripe form use `4242 4242 4242 4242`, any future expiry, any CVC.
3. Land on `/booking/success` — the page should poll and show "Confirmed" within a few seconds (webhook fires).
4. As admin, go to `/admin/bookings` — the new row should appear as `confirmed`.

**Booking as logged-in user**
1. Sign in as a non-admin customer. Repeat the booking flow.
2. After success, go to `/dashboard` — the booking should now appear under Upcoming (this is the #1 bug being fixed).

**Approval-mode toggle**
1. As admin at `/admin/settings`, turn on Require approval. Save.
2. Sign in as a customer, book + pay with `4242...` card. Booking should be `paid` but `pending_approval`.
3. As admin at `/admin/bookings`, click Approve. Status flips to `confirmed`; calendar event is created.

**Status transitions & completion**
1. Admin walks a booking through en_route → arrived → picked_up → completed.
2. Confirm `revenue_records` gets a row on completion (visible via `/admin` revenue cards).
3. Customer sees a "Leave a review" prompt on `/dashboard`.

**Reviews**
1. Customer submits a 5-star review. Admin sees it at `/admin/reviews` as pending.
2. Admin approves. Refresh home page — the review appears in testimonials.

**Failure cards**
- `4000 0000 0000 0002` (declined) — booking stays `pending_approval`, `payment_status='failed'`, no calendar event.
- `4000 0025 0000 3155` (3DS required) — completes 3DS challenge, then confirms.

**Google Calendar**
- After a confirmed booking, open your Google Calendar → event should exist at `pickup_at` with the reservation number.
- Cancel the booking from admin → event disappears.

This plan does NOT wire: SMS notifications, coupons, referral rewards, loyalty auto-discount, favorites, or driver availability switch — per your "skip for now" answer. All schema for those remains in place for a future phase.

Approve to proceed, or tell me what to trim/reorder.
