
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
CREATE TYPE public.trip_status AS ENUM (
  'pending_approval','confirmed','driver_preparing','driver_en_route',
  'driver_arrived','picked_up','completed','canceled'
);
CREATE TYPE public.payment_status AS ENUM ('unpaid','deposit_paid','paid','refunded','partially_refunded');
CREATE TYPE public.driver_status AS ENUM ('available','offline','vacation','busy','not_accepting');
CREATE TYPE public.discount_type AS ENUM ('percentage','fixed');
CREATE TYPE public.loyalty_tier AS ENUM ('standard','bronze','silver','vip');

-- =====================================================
-- HELPER: updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  loyalty_tier public.loyalty_tier NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- USER ROLES
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + assign role on signup (first user = admin, rest = customer)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')
  );

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  IF NOT admin_exists THEN
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

-- =====================================================
-- ADMIN SETTINGS (single row)
-- =====================================================
CREATE TABLE public.admin_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_fare NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  per_mile_rate NUMERIC(10,2) NOT NULL DEFAULT 3.50,
  per_minute_rate NUMERIC(10,2) NOT NULL DEFAULT 0.75,
  booking_fee NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  airport_surcharge NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  stop_fee NUMERIC(10,2) NOT NULL DEFAULT 8.00,
  deposit_percentage INT NOT NULL DEFAULT 25,
  preparation_buffer_minutes INT NOT NULL DEFAULT 30,
  minimum_booking_block_minutes INT NOT NULL DEFAULT 120,
  minimum_advance_notice_minutes INT NOT NULL DEFAULT 60,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  approval_deadline_minutes INT NOT NULL DEFAULT 60,
  auto_decline_on_timeout BOOLEAN NOT NULL DEFAULT true,
  loyalty_5_discount INT NOT NULL DEFAULT 5,
  loyalty_10_discount INT NOT NULL DEFAULT 10,
  loyalty_20_vip BOOLEAN NOT NULL DEFAULT true,
  loyalty_combines_with_coupons BOOLEAN NOT NULL DEFAULT false,
  referral_new_customer_discount NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  referral_referrer_reward NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  referral_minimum_ride_value NUMERIC(10,2) NOT NULL DEFAULT 30.00,
  referral_reward_expiration_days INT NOT NULL DEFAULT 180,
  referral_combines_with_coupons BOOLEAN NOT NULL DEFAULT false,
  sms_enabled JSONB NOT NULL DEFAULT '{
    "booking_received":true,"payment_received":true,"driver_confirmed":true,
    "driver_preparing":true,"driver_en_route":true,"driver_arrived":true,
    "picked_up":true,"completed":true,"changed":true,"canceled":true,
    "refunded":true,"pickup_reminder":true
  }'::jsonb,
  google_calendar_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.admin_settings (id) VALUES (1);
GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settings_read_all_auth" ON public.admin_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_settings_admin_update" ON public.admin_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- AVAILABILITY STATUS
-- =====================================================
CREATE TABLE public.availability_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.driver_status NOT NULL DEFAULT 'available',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  customer_message TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.availability_status TO anon, authenticated;
GRANT ALL ON public.availability_status TO service_role;
ALTER TABLE public.availability_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability_public_read" ON public.availability_status FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "availability_admin_write" ON public.availability_status FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.availability_status (status) VALUES ('available');

-- =====================================================
-- COUPONS
-- =====================================================
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type public.discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  minimum_purchase NUMERIC(10,2) NOT NULL DEFAULT 0,
  maximum_discount NUMERIC(10,2),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  max_total_uses INT,
  max_uses_per_customer INT NOT NULL DEFAULT 1,
  service_restrictions JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_read_active_auth" ON public.coupons FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- REFERRALS
-- =====================================================
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  successful_referrals INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_self_read" ON public.referrals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- LOYALTY ACCOUNTS
-- =====================================================
CREATE TABLE public.loyalty_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_rides INT NOT NULL DEFAULT 0,
  available_discount_percent INT NOT NULL DEFAULT 0,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_self_read" ON public.loyalty_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- NOTIFICATION PREFERENCES
-- =====================================================
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_self_all" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- BOOKINGS
-- =====================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT NOT NULL UNIQUE DEFAULT ('SS-' || upper(substr(md5(random()::text), 1, 8))),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- contact snapshot
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- trip
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC(10,7),
  pickup_lng NUMERIC(10,7),
  destination_address TEXT NOT NULL,
  destination_lat NUMERIC(10,7),
  destination_lng NUMERIC(10,7),
  pickup_at TIMESTAMPTZ NOT NULL,
  is_round_trip BOOLEAN NOT NULL DEFAULT false,
  return_at TIMESTAMPTZ,
  passengers INT NOT NULL DEFAULT 1,
  bags INT NOT NULL DEFAULT 0,
  extra_stops TEXT,
  special_instructions TEXT,
  -- calculation
  distance_miles NUMERIC(10,2),
  duration_minutes INT,
  estimated_end_at TIMESTAMPTZ,
  -- fare breakdown
  base_fare NUMERIC(10,2) NOT NULL DEFAULT 0,
  mileage_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  time_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  booking_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  airport_stop_fees NUMERIC(10,2) NOT NULL DEFAULT 0,
  toll_estimate NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- codes applied
  coupon_id UUID REFERENCES public.coupons(id),
  referred_by_code TEXT,
  loyalty_discount_applied INT NOT NULL DEFAULT 0,
  -- status
  trip_status public.trip_status NOT NULL DEFAULT 'confirmed',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  google_calendar_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_pickup ON public.bookings(pickup_at);
CREATE INDEX idx_bookings_status ON public.bookings(trip_status);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_self_select" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings_self_insert" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_self_update" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Overlap prevention (excludes canceled)
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_end TIMESTAMPTZ;
BEGIN
  IF NEW.trip_status = 'canceled' THEN RETURN NEW; END IF;
  new_end := COALESCE(NEW.estimated_end_at, NEW.pickup_at + INTERVAL '2 hours');
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id <> NEW.id
      AND b.trip_status <> 'canceled'
      AND tstzrange(b.pickup_at, COALESCE(b.estimated_end_at, b.pickup_at + INTERVAL '2 hours'), '[)')
          && tstzrange(NEW.pickup_at, new_end, '[)')
  ) THEN
    RAISE EXCEPTION 'Time slot conflicts with an existing booking';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bookings_no_overlap BEFORE INSERT OR UPDATE OF pickup_at, estimated_end_at, trip_status
  ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

-- =====================================================
-- TRIP STATUS HISTORY
-- =====================================================
CREATE TABLE public.trip_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  status public.trip_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tsh_booking ON public.trip_status_history(booking_id);
GRANT SELECT ON public.trip_status_history TO authenticated;
GRANT ALL ON public.trip_status_history TO service_role;
ALTER TABLE public.trip_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tsh_read_own_or_admin" ON public.trip_status_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

-- Log status changes automatically
CREATE OR REPLACE FUNCTION public.log_trip_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.trip_status IS DISTINCT FROM OLD.trip_status THEN
    INSERT INTO public.trip_status_history (booking_id, status, changed_by)
    VALUES (NEW.id, NEW.trip_status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bookings_status_log AFTER INSERT OR UPDATE OF trip_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_trip_status();

-- =====================================================
-- CUSTOMER FAVORITES
-- =====================================================
CREATE TABLE public.customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_favorites TO authenticated;
GRANT ALL ON public.customer_favorites TO service_role;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_self_all" ON public.customer_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- COUPON USAGE
-- =====================================================
CREATE TABLE public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupon_usage TO authenticated;
GRANT ALL ON public.coupon_usage TO service_role;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon_usage_self_read" ON public.coupon_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- REFERRAL REWARDS
-- =====================================================
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  reward_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, available, used, expired
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_rewards_self_read" ON public.referral_rewards FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- LOYALTY TRANSACTIONS
-- =====================================================
CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- ride_completed, tier_upgrade, discount_applied
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_tx_self_read" ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- CUSTOMER REVIEWS
-- =====================================================
CREATE TABLE public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  admin_response TEXT,
  service_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.customer_reviews TO authenticated;
GRANT ALL ON public.customer_reviews TO service_role;
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_approved" ON public.customer_reviews FOR SELECT TO anon, authenticated
  USING (is_approved = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reviews_insert_own_completed" ON public.customer_reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.trip_status = 'completed'
    )
  );
CREATE POLICY "reviews_admin_update" ON public.customer_reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.customer_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- SMS LOGS
-- =====================================================
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  provider_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_logs_admin_read" ON public.sms_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- CALENDAR CONNECTIONS
-- =====================================================
CREATE TABLE public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  connection_key_ciphertext TEXT NOT NULL,
  calendar_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
GRANT ALL ON public.calendar_connections TO service_role;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- BOOKING HOLDS (checkout locks)
-- =====================================================
CREATE TABLE public.booking_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holds_expires ON public.booking_holds(expires_at);
GRANT ALL ON public.booking_holds TO service_role;
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holds_self_read" ON public.booking_holds FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- REVENUE RECORDS
-- =====================================================
CREATE TABLE public.revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL, -- deposit, full, balance, refund
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_date ON public.revenue_records(recorded_at);
GRANT ALL ON public.revenue_records TO service_role;
ALTER TABLE public.revenue_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenue_admin_read" ON public.revenue_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- Attach signup trigger to auth.users (uses schema owner privileges)
-- =====================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
