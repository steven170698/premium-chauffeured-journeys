
-- 1. Public pricing view (replaces broad admin_settings anon SELECT)
DROP POLICY IF EXISTS admin_settings_read_public ON public.admin_settings;
REVOKE SELECT ON public.admin_settings FROM anon;

CREATE OR REPLACE VIEW public.public_pricing
WITH (security_invoker = true) AS
SELECT
  base_fare,
  per_mile_rate,
  per_minute_rate,
  booking_fee,
  airport_surcharge,
  stop_fee
FROM public.admin_settings
WHERE id = 1;

-- Since view uses security_invoker, we need a policy that lets anon read the row
CREATE POLICY admin_settings_pricing_public ON public.admin_settings
  FOR SELECT TO anon
  USING (id = 1);

GRANT SELECT ON public.public_pricing TO anon, authenticated;
GRANT SELECT ON public.admin_settings TO anon;  -- limited by the row policy above

-- 2. Overlap trigger: exclude abandoned unpaid bookings > 30 min old
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_end TIMESTAMPTZ;
BEGIN
  IF NEW.trip_status = 'canceled' THEN RETURN NEW; END IF;
  new_end := COALESCE(NEW.estimated_end_at, NEW.pickup_at + INTERVAL '2 hours');
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id <> NEW.id
      AND b.trip_status <> 'canceled'
      -- ignore abandoned unpaid pending bookings older than 30 min
      AND NOT (
        b.trip_status = 'pending_approval'
        AND b.payment_status = 'unpaid'
        AND b.created_at < now() - INTERVAL '30 minutes'
      )
      AND tstzrange(b.pickup_at, COALESCE(b.estimated_end_at, b.pickup_at + INTERVAL '2 hours'), '[)')
          && tstzrange(NEW.pickup_at, new_end, '[)')
  ) THEN
    RAISE EXCEPTION 'Time slot conflicts with an existing booking';
  END IF;
  RETURN NEW;
END; $$;

-- 3. Cleanup fn (admins call from dashboard load)
CREATE OR REPLACE FUNCTION public.mark_abandoned_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.bookings
  SET trip_status = 'canceled'
  WHERE trip_status = 'pending_approval'
    AND payment_status = 'unpaid'
    AND created_at < now() - INTERVAL '30 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END; $$;

REVOKE EXECUTE ON FUNCTION public.mark_abandoned_bookings() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_bookings() TO authenticated;

-- 4. Revenue records writer trigger
CREATE OR REPLACE FUNCTION public.record_booking_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trip_status = 'completed'
     AND (OLD.trip_status IS DISTINCT FROM 'completed')
     AND NEW.payment_status = 'paid' THEN
    INSERT INTO public.revenue_records (booking_id, amount, payment_type)
    VALUES (NEW.id, NEW.amount_paid, 'ride')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Ensure idempotency on the revenue record per booking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'revenue_records_booking_id_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX revenue_records_booking_id_unique ON public.revenue_records(booking_id)';
  END IF;
END $$;

DROP TRIGGER IF EXISTS record_booking_revenue_trg ON public.bookings;
CREATE TRIGGER record_booking_revenue_trg
  AFTER UPDATE OF trip_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.record_booking_revenue();

-- 5. Fix first-user-admin footgun: only bootstrap when truly empty
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_fresh_install BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')
  );

  -- Only auto-grant admin on a truly empty install
  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles)
     AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id <> NEW.id)
  INTO is_fresh_install;

  IF is_fresh_install THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  END IF;

  INSERT INTO public.loyalty_accounts (user_id) VALUES (NEW.id);
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.referrals (user_id, referral_code)
    VALUES (NEW.id, upper(substr(md5(NEW.id::text || random()::text), 1, 8)));
  RETURN NEW;
END; $$;

-- 6. Admin update policy on admin_settings (for settings editor)
DROP POLICY IF EXISTS admin_settings_admin_update ON public.admin_settings;
CREATE POLICY admin_settings_admin_update ON public.admin_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Admin update policy on customer_reviews (moderation)
DROP POLICY IF EXISTS customer_reviews_admin_update ON public.customer_reviews;
CREATE POLICY customer_reviews_admin_update ON public.customer_reviews
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
