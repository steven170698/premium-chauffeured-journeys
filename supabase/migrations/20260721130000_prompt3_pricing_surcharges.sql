-- =====================================================================
-- Stevie Services LLC — Prompt 3 (pricing engine), slice 1
-- Configurable minimum fare + night/weekend/holiday surcharges,
-- hourly & service-fee knobs, and an admin-managed holiday calendar.
-- =====================================================================
-- SAFE, ADDITIVE, REVERSIBLE:
--   * Only ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
--   * public_pricing view is recreated with the SAME existing columns first
--     (order preserved) and new pricing fields appended — no column removed.
--   * Reuses public.has_role(); RLS enabled only on the new table.
--   * Idempotent. Rollback block at the bottom.
-- =====================================================================

BEGIN;

-- 1. admin_settings — new pricing knobs (single row id=1; existing row gets defaults)
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS minimum_fare          numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS night_surcharge_pct   numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS night_start_hour      integer NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS night_end_hour        integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS weekend_surcharge_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS holiday_surcharge_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS hourly_rate           numeric NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS minimum_hourly_hours  integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS meet_greet_fee        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS child_seat_fee        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_stacking    text    NOT NULL DEFAULT 'stack';

-- 2. bookings — record the surcharge portion of the fare (additive)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric NOT NULL DEFAULT 0;

-- 3. public_pricing view — expose the new (non-secret) pricing fields to the
--    client-facing quote. Existing 6 columns kept first, new ones appended.
CREATE OR REPLACE VIEW public.public_pricing
WITH (security_invoker = true) AS
SELECT
  base_fare,
  per_mile_rate,
  per_minute_rate,
  booking_fee,
  airport_surcharge,
  stop_fee,
  minimum_fare,
  night_surcharge_pct,
  night_start_hour,
  night_end_hour,
  weekend_surcharge_pct,
  holiday_surcharge_pct,
  hourly_rate,
  minimum_hourly_hours,
  meet_greet_fee,
  child_seat_fee,
  surcharge_stacking
FROM public.admin_settings
WHERE id = 1;

GRANT SELECT ON public.public_pricing TO anon, authenticated;

-- 4. pricing_holidays — admin-managed holiday calendar (drives the holiday surcharge)
CREATE TABLE IF NOT EXISTS public.pricing_holidays (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  holiday_date  date NOT NULL,
  surcharge_pct numeric NOT NULL DEFAULT 20,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_holidays_date_idx ON public.pricing_holidays (holiday_date);

ALTER TABLE public.pricing_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing_holidays_public_read" ON public.pricing_holidays;
CREATE POLICY "pricing_holidays_public_read" ON public.pricing_holidays
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "pricing_holidays_admin_all" ON public.pricing_holidays;
CREATE POLICY "pricing_holidays_admin_all" ON public.pricing_holidays
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.pricing_holidays TO anon, authenticated;

COMMIT;

-- =====================================================================
-- ROLLBACK — uncomment and run to reverse.
-- =====================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.pricing_holidays;
-- CREATE OR REPLACE VIEW public.public_pricing
-- WITH (security_invoker = true) AS
-- SELECT base_fare, per_mile_rate, per_minute_rate, booking_fee, airport_surcharge, stop_fee
-- FROM public.admin_settings WHERE id = 1;
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS surcharge_amount;
-- ALTER TABLE public.admin_settings
--   DROP COLUMN IF EXISTS minimum_fare,
--   DROP COLUMN IF EXISTS night_surcharge_pct,
--   DROP COLUMN IF EXISTS night_start_hour,
--   DROP COLUMN IF EXISTS night_end_hour,
--   DROP COLUMN IF EXISTS weekend_surcharge_pct,
--   DROP COLUMN IF EXISTS holiday_surcharge_pct,
--   DROP COLUMN IF EXISTS hourly_rate,
--   DROP COLUMN IF EXISTS minimum_hourly_hours,
--   DROP COLUMN IF EXISTS meet_greet_fee,
--   DROP COLUMN IF EXISTS child_seat_fee,
--   DROP COLUMN IF EXISTS surcharge_stacking;
-- COMMIT;
