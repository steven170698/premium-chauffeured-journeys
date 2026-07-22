This is a very large scope — realistically 20+ new admin pages, a dozen new tables (drivers, vehicles, promo codes, corporate accounts, audit logs, email/SMS templates, service areas), new RLS, refund flows through Stripe, realtime, exports, analytics, and a role hierarchy (Owner/Dispatcher/Finance/etc.).

Rather than attempt all of that in one pass (which would break working features and burn a lot of credits on things you may not need soon), I want to ship this in focused, verifiable phases. Everything preserves your existing tables, routes, Stripe/Maps/Supabase setup, and the black/gold/white design system.

## Proposed phasing

**Phase A — Admin shell + security hardening + Overview upgrade**
- New sidebar layout (`_authenticated/admin/route.tsx`) with collapsible groups, mobile slide-out, top header with search box, notification bell (wired to existing `notifications` table), admin profile menu, sign-out.
- Server-side role guard middleware (`requireAdmin`) applied to every admin server fn — not just route redirect. Adds defense-in-depth beyond the current `beforeLoad` check.
- Expand Overview KPIs: today/week/month revenue with prior-period deltas, pending approvals, awaiting payment, active trips, completed, cancelled, unread support, refunds pending. Each card links to filtered list. Real data only.
- "Today's Operations" panel: today's pickups sorted chronologically, active trip, delayed rides, payment issues.
- Global search (reservation #, customer name/email/phone) in header.

**Phase B — Booking management depth**
- Booking details page (`/admin/bookings/$id`) with full timeline, pricing breakdown, payment history, notifications sent, internal notes, audit history, route map.
- Actions gated by status: approve, decline w/ reason, cancel, mark no-show, adjust quote (with reason → audit), resend payment link, add internal note.
- Filters: date range, status, payment status, service type, search. Pagination.
- Manual booking creation (`/admin/bookings/new`) reusing `PlaceAutocomplete` + `computeQuote` + existing `requestBooking` path; admin can auto-approve and send payment link in one flow.

**Phase C — Customers + Reviews + Support + Notifications center**
- `/admin/customers` list + detail (profile, booking history, payments, refunds, reviews, notes). Read-only on auth-sensitive fields (no password access).
- `/admin/reviews` moderation (approve/hide, respond) — extend existing reviews route.
- `/admin/support` inbox using existing `support_requests` table (statuses, assignment, reply, link to booking).
- `/admin/notifications` center with mark-read/archive, filtered feed off existing `notifications` table.
- Supabase Realtime subscriptions on bookings, payments, support_requests, reviews — single subscriber in the admin layout, invalidates React Query.

**Phase D — Payments + Refunds**
- `/admin/payments` list backed by bookings + Stripe payment intent IDs already stored. Filters, export CSV.
- `/admin/refunds`: refund workflow that calls Stripe refund API server-side, updates only after webhook confirms (extend existing `webhook.ts` to handle `charge.refunded`). Confirmation modals for full/large/post-trip refunds. Audit entry per refund.

**Phase E — Pricing, Discounts, Holidays, Business Settings**
- Wire `/admin/settings` to every field in `admin_settings` (base fare, per-mile, per-min, minimum fare, waiting, airport, hourly, stops, night/weekend/holiday surcharges, meet & greet, child seat, cancellation policy text, payment expiration, lead time, timezone, etc.). Confirmation on save + write to a new `pricing_history` audit table so historical booking prices stay untouched.
- `/admin/holidays` CRUD on existing `pricing_holidays`.
- `/admin/discounts` CRUD on existing `coupons` (activate/deactivate, usage limits, date limits, min booking amount).

**Phase F — Reports + Analytics + Audit log viewer**
- `/admin/reports` with revenue, bookings, cancellations, refunds, discount usage, airport, hourly reports. Filters + CSV export.
- `/admin/analytics` charts (revenue by day/week/month, bookings by status, top pickup areas, cancellation rate, avg booking value, payment success rate) via `recharts`.
- `/admin/audit` viewer on existing `booking_audit_log` plus new admin action logging middleware. Read-only, non-deletable.

**Phase G (deferred — needs product decisions)**
- Drivers / Vehicles / Corporate Accounts / Service Areas / Email & SMS template editor / expanded role hierarchy (Dispatcher/Finance/Read-Only). These need new tables + workflows and — since you operate as one driver + one CR-V today — they may not pay for themselves right now. I'd rather build them when you're actually hiring or onboarding a fleet.

## Database changes (only additive, no destructive edits)
- New `pricing_history` table (snapshot per settings change: changed_by, changed_at, old_json, new_json, reason).
- New `admin_action_log` table for non-booking audit events (role changes, pricing edits, refunds, template edits).
- New `refund_requests` table (booking_id, amount, reason, stripe_refund_id, status, requested_by, processed_at) — refund state machine driven by webhook.
- Extend `notifications` with `archived_at` if not present.
- New `admin_notes` table on bookings and customers, or reuse existing `driver_notes`/booking `internal_notes` if already there — I'll check first.
- No changes to bookings, payments, customers, drivers, vehicles historical data.

All new tables ship with GRANTs + RLS scoped to admin role via `has_role`.

## What I want to confirm before starting

1. **Start with Phase A only this turn?** It's the foundation (shell, real security, upgraded overview, global search, notification bell). I estimate ~6-8 new/modified files and one small migration. You'll be able to see and use it immediately, and each subsequent phase builds on it.
2. **Phase G confirmation**: OK to defer drivers/vehicles/corporate/service-areas/template-editor/expanded-roles until you actually need them? Your current setup (one driver, one CR-V, you as sole admin) doesn't exercise them.
3. **Refund policy default** (for Phase D): what percentage refunded for cancellations at >24h, 24-2h, <2h, no-show? I'll code it into `refund_requests` calculator.

Reply with "go Phase A" (plus answers to 2 and 3 when you're ready) and I'll ship it.