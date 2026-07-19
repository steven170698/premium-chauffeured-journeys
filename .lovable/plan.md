
# Request-First Booking Workflow

Rework the booking flow so **no money moves until the driver approves**. The Stripe Checkout session is only created after approval, the reserved time is held during approval and the payment window, and confirmation happens only on a verified Stripe webhook.

## New status lifecycle

```text
customer submits ─► pending_approval ─► (driver approves) ─► awaiting_payment ─► (webhook) ─► confirmed ─► completed
                                    └─► (driver declines) ─► declined
                                    └─► (approval timeout) ─► declined
                     awaiting_payment ─► (payment timeout) ─► payment_expired
```

Existing statuses `confirmed`, `driver_en_route`, `driver_arrived`, `picked_up`, `completed`, `canceled` are unchanged. Adding: `awaiting_payment`, `declined`, `payment_expired`.

## What changes

### Database (single migration)
- Extend `trip_status` enum with `awaiting_payment`, `declined`, `payment_expired`.
- Add booking columns: `approval_deadline_at`, `payment_deadline_at`, `approved_at`, `declined_at`.
- Add admin settings: `hold_during_approval` (default true), `payment_window_minutes` (default 30), `auto_confirm_future_bookings` (default false). Reuse existing `approval_deadline_minutes` for the driver response window (default set to 30). Existing `require_approval` toggle is kept.
- Rewrite `check_booking_overlap` trigger: only block against active statuses; treat `pending_approval` and `awaiting_payment` as blocking only until their respective deadline. Respect `hold_during_approval = false` to skip holding during driver review.
- Rewrite `mark_abandoned_bookings()`: transition expired `pending_approval` → `declined`, expired `awaiting_payment` → `payment_expired`.

### Backend server functions
- `book.request` (new, replaces charge-first flow): validates input, recomputes quote, checks slot, inserts booking with status `pending_approval` (or `awaiting_payment` immediately if `require_approval=false` AND `auto_confirm_future_bookings=true`), sets `approval_deadline_at = now + approval_deadline_minutes`. **No Stripe call.**
- `admin.approveBooking`: recomputes quote, rechecks availability, sets status `awaiting_payment`, `approved_at`, `payment_deadline_at`, creates Stripe Checkout Session for the exact approved price, stores `stripe_session_id` + `client_secret`. Returns the payment URL.
- `admin.declineBooking`: sets status `declined`, `declined_at`, releases slot.
- `customer.startPayment(bookingId)`: for the current customer or a signed link — verifies booking is `awaiting_payment` and `payment_deadline_at > now`, returns the existing Stripe `client_secret` (recreates if the session expired).
- Webhook: only flips a booking to `confirmed` + `paid` if it is currently `awaiting_payment` and its slot is still free (recheck overlap right before the write). Otherwise ignores or refunds via existing admin path.

### UI
- **`/book`**: submit button renamed to "Request This Ride"; on success shows a "Pending driver approval" confirmation with reservation number and deadline. No Stripe modal on this page.
- **Customer `/dashboard`**: for bookings in `awaiting_payment`, display remaining time and a "Pay now" button that opens the Stripe embedded checkout using `customer.startPayment`.
- **Admin `/admin/bookings`**: Approve/Decline buttons for `pending_approval`. Approve opens a small confirmation showing recomputed price and creates the payment link. New status chips for `awaiting_payment`, `declined`, `payment_expired`.
- **Admin `/admin/settings`**: add fields for approval window (minutes), payment window (minutes), "Hold requested time during approval", "Auto-confirm future bookings".

## Test plan (preview)

1. Sign in as customer → `/book` → fill in details → **Request This Ride** → confirmation with reservation number.
2. Sign in as admin → `/admin/bookings` → click **Approve** on the pending row. Status flips to `awaiting_payment`, payment deadline appears.
3. As the customer → `/dashboard` → **Pay now** → Stripe embedded checkout → use test card `4242 4242 4242 4242`, any future expiry, any CVC → status flips to `confirmed` after the webhook lands.
4. Second scenario: submit another request → admin **Decline** → status shows `declined`, slot is freed (a new booking at that time is accepted).
5. Third scenario: approve a request but do not pay → after `payment_window_minutes`, status auto-flips to `payment_expired` on the next admin page load.

## Safety guarantees

- Server-side re-validation of price, slot, and status happens **immediately before** creating the Stripe session and again inside the webhook.
- No Stripe API call is made on the customer request path.
- Success-page URL never confirms a booking — only the signed webhook does.
