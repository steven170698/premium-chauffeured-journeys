## Goal

Stabilize the existing Stevie Services LLC platform without rebuilding. Preserve Supabase, Stripe, Google Maps, custom domain, and all existing data/routes. Repair, don't replace.

## Scope of this prompt (foundation only)

Deliberately excluded (reserved for later prompts, as you instructed): redesigning booking, pricing, payments, notifications, dashboards, SMS, email templates, invoices, refunds workflow beyond wiring.

## 1. Audit pass (no code changes)

Inspect and report on:
- Route inventory vs. required public pages (Home, About, Services, Airport, Hourly, FAQ, Contact, Book, Privacy, Terms, Cancellation/Refund).
- Existing DB tables vs. required entities (profiles, bookings, trips, payments, refunds, invoices, reviews, coupons, loyalty, referrals, notifications, saved addresses, audit logs, admin_settings, user_roles, vehicles).
- Duplicate/legacy modules (e.g. `checkout.functions.ts` legacy vs. `payment.functions.ts` request-first flow).
- Role guard coverage on `/admin/*` and `/dashboard`.
- Console errors, missing env vars, broken links.

Deliverable: audit summary in chat at the end.

## 2. Repairs (code changes limited to stabilization)

Create only what's missing; skip if present.

**Public pages** — add stubs with real branded content, SEO head(), and footer links:
- `/about`
- `/services`
- `/services/airport`
- `/services/hourly`
- `/faq`
- `/privacy`
- `/terms`
- `/cancellation-policy`

Do NOT touch `/`, `/book`, `/contact`, `/auth`, `/booking/success`, `/dashboard`, `/admin/*` beyond adding footer nav links to the new pages.

**Guest fare display** — hide the per-mile / per-minute breakdown from unauthenticated users on `/book`, showing only the total estimate (per your rule "guests cannot see all detail of the fare"). Signed-in customers still see the itemized breakdown.

**Role guard hardening** — verify `/admin` `beforeLoad` correctly redirects non-admins; add a small `useRole` helper if missing. No policy changes.

**Error/empty states** — add graceful fallbacks (already partially present) for:
- Google Maps script load failure on `/book` and `/contact`
- Fare quote failure
- Booking submission failure
Reuse existing toast + inline error patterns.

**Mobile polish on driver dashboard** — ensure action buttons (Approve, Decline, En Route, Arrived, Start, Complete) meet a 44px min tap target. CSS-only tweaks.

**Footer** — add links to the new legal/info pages.

## 3. Database

No destructive changes. Only additive if a required table is missing after audit. Expected outcome based on current schema: **no migration needed**; report will confirm.

## 4. Explicitly NOT doing this turn

- No changes to auth flows, Stripe wiring, webhook, quote engine, trip tracker, reconciliation logic, or admin settings shape.
- No new SMS / email provider setup.
- No new roles table or RLS rewrites.
- No visual redesign.

## 5. Deliverable at end

A summary covering: repaired, preserved, still incomplete, blocked-on-credentials, DB changes (expected: none), files touched.

---

Approve to proceed, or tell me which sections to trim/expand.