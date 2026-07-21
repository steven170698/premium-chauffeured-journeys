ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS first_name            text,
  ADD COLUMN IF NOT EXISTS last_name             text,
  ADD COLUMN IF NOT EXISTS trip_type             text NOT NULL DEFAULT 'one_way',
  ADD COLUMN IF NOT EXISTS flight_number         text,
  ADD COLUMN IF NOT EXISTS airline               text,
  ADD COLUMN IF NOT EXISTS airport_terminal      text,
  ADD COLUMN IF NOT EXISTS meet_and_greet        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS child_seat            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accessibility_request text,
  ADD COLUMN IF NOT EXISTS hourly_hours          numeric,
  ADD COLUMN IF NOT EXISTS pickup_place_id       text,
  ADD COLUMN IF NOT EXISTS destination_place_id  text,
  ADD COLUMN IF NOT EXISTS decline_reason        text,
  ADD COLUMN IF NOT EXISTS approved_by           uuid,
  ADD COLUMN IF NOT EXISTS declined_by           uuid,
  ADD COLUMN IF NOT EXISTS booking_source        text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS idempotency_key       text;

UPDATE public.bookings
   SET trip_type = CASE WHEN is_round_trip THEN 'round_trip' ELSE 'one_way' END
 WHERE trip_type = 'one_way';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_key_uidx
  ON public.bookings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.booking_stops (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 1,
  address     text NOT NULL,
  place_id    text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_stops_booking_idx ON public.booking_stops (booking_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_stops TO authenticated;
GRANT ALL ON public.booking_stops TO service_role;
ALTER TABLE public.booking_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_stops_select_own_or_admin" ON public.booking_stops;
CREATE POLICY "booking_stops_select_own_or_admin" ON public.booking_stops
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_stops.booking_id AND (b.user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))));

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,
  audience    text NOT NULL DEFAULT 'customer',
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  is_read     boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx   ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id, is_read);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_select_own_or_admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "notifications_update_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_update_own_or_admin" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.email_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id       uuid,
  event_type    text NOT NULL DEFAULT 'generic',
  recipient     text NOT NULL,
  subject       text,
  status        text NOT NULL DEFAULT 'sent',
  provider_id   text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_logs_booking_idx ON public.email_logs (booking_id);
CREATE INDEX IF NOT EXISTS email_logs_event_idx   ON public.email_logs (event_type, created_at DESC);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_logs_admin_read" ON public.email_logs;
CREATE POLICY "email_logs_admin_read" ON public.email_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.support_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new',
  source      text NOT NULL DEFAULT 'contact_form',
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id     uuid,
  assigned_to uuid,
  admin_notes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON public.support_requests (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_requests_admin_all" ON public.support_requests;
CREATE POLICY "support_requests_admin_all" ON public.support_requests
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "support_requests_insert_authenticated" ON public.support_requests;
CREATE POLICY "support_requests_insert_authenticated" ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_support_requests_updated ON public.support_requests;
CREATE TRIGGER trg_support_requests_updated BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS surcharge_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE VIEW public.public_pricing
WITH (security_invoker = true) AS
SELECT
  base_fare, per_mile_rate, per_minute_rate, booking_fee, airport_surcharge, stop_fee,
  minimum_fare, night_surcharge_pct, night_start_hour, night_end_hour,
  weekend_surcharge_pct, holiday_surcharge_pct, hourly_rate, minimum_hourly_hours,
  meet_greet_fee, child_seat_fee, surcharge_stacking
FROM public.admin_settings
WHERE id = 1;

GRANT SELECT ON public.public_pricing TO anon, authenticated;

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
GRANT SELECT ON public.pricing_holidays TO anon, authenticated;
GRANT ALL ON public.pricing_holidays TO service_role;
ALTER TABLE public.pricing_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing_holidays_public_read" ON public.pricing_holidays;
CREATE POLICY "pricing_holidays_public_read" ON public.pricing_holidays
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "pricing_holidays_admin_all" ON public.pricing_holidays;
CREATE POLICY "pricing_holidays_admin_all" ON public.pricing_holidays
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));