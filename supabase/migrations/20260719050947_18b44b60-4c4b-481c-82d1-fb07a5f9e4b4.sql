
-- Phase 1: fare-estimate transparency + tracking columns

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS waiting_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS free_pickup_waiting_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pickup_waiting_rate numeric(10,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS free_stop_waiting_minutes integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS stop_waiting_rate numeric(10,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS max_waiting_charge numeric(10,2) NOT NULL DEFAULT 60.00,
  ADD COLUMN IF NOT EXISTS max_automatic_fare_increase integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS allow_off_session_charges boolean NOT NULL DEFAULT true;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS estimated_distance_miles numeric(10,2),
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS estimated_fare numeric(10,2),
  ADD COLUMN IF NOT EXISTS actual_distance_miles numeric(10,2),
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS pickup_waiting_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stop_waiting_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_waiting_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billable_waiting_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_delay_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trip_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trip_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiting_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiting_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS gps_tracking_status text,
  ADD COLUMN IF NOT EXISTS toll_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parking_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_fare numeric(10,2),
  ADD COLUMN IF NOT EXISTS remaining_balance numeric(10,2),
  ADD COLUMN IF NOT EXISTS fare_adjustment_percentage numeric(6,2),
  ADD COLUMN IF NOT EXISTS customer_fare_policy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_charge_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;

-- Backfill estimate snapshots so completed-ride receipts have data to compare against
UPDATE public.bookings
SET estimated_distance_miles = COALESCE(estimated_distance_miles, distance_miles),
    estimated_duration_minutes = COALESCE(estimated_duration_minutes, duration_minutes),
    estimated_fare = COALESCE(estimated_fare, total);

-- GPS points recorded during an active trip.
CREATE TABLE IF NOT EXISTS public.trip_location_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  accuracy numeric(10,2),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  trip_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.trip_location_points TO authenticated;
GRANT ALL ON public.trip_location_points TO service_role;

ALTER TABLE public.trip_location_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_points_admin_all" ON public.trip_location_points
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_trip_points_booking ON public.trip_location_points(booking_id, recorded_at);

-- Audit log for manual admin changes to tracked / fare data.
CREATE TABLE IF NOT EXISTS public.booking_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_audit_log TO authenticated;
GRANT ALL ON public.booking_audit_log TO service_role;

ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_audit_admin_all" ON public.booking_audit_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_booking ON public.booking_audit_log(booking_id, created_at DESC);
