
DROP POLICY IF EXISTS admin_settings_pricing_public ON public.admin_settings;
REVOKE SELECT ON public.admin_settings FROM anon;

DROP POLICY IF EXISTS availability_public_read ON public.availability_status;
REVOKE SELECT ON public.availability_status FROM anon;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM authenticated;

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS user_roles_self_read ON public.user_roles;
CREATE POLICY user_roles_self_read ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS availability_admin_write ON public.availability_status;
CREATE POLICY availability_admin_write ON public.availability_status FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS coupons_read_active_auth ON public.coupons;
CREATE POLICY coupons_read_active_auth ON public.coupons FOR SELECT TO authenticated
  USING (is_active OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS referrals_self_read ON public.referrals;
CREATE POLICY referrals_self_read ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS loyalty_self_read ON public.loyalty_accounts;
CREATE POLICY loyalty_self_read ON public.loyalty_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS notif_self_all ON public.notification_preferences;
CREATE POLICY notif_self_all ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS bookings_self_select ON public.bookings;
CREATE POLICY bookings_self_select ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS bookings_self_update ON public.bookings;
CREATE POLICY bookings_self_update ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS trip_points_admin_all ON public.trip_location_points;
CREATE POLICY trip_points_admin_all ON public.trip_location_points FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS tsh_read_own_or_admin ON public.trip_status_history;
CREATE POLICY tsh_read_own_or_admin ON public.trip_status_history FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = trip_status_history.booking_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS fav_self_all ON public.customer_favorites;
CREATE POLICY fav_self_all ON public.customer_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS coupon_usage_self_read ON public.coupon_usage;
CREATE POLICY coupon_usage_self_read ON public.coupon_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS referral_rewards_self_read ON public.referral_rewards;
CREATE POLICY referral_rewards_self_read ON public.referral_rewards FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS loyalty_tx_self_read ON public.loyalty_transactions;
CREATE POLICY loyalty_tx_self_read ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS reviews_public_approved ON public.customer_reviews;
CREATE POLICY reviews_public_approved ON public.customer_reviews FOR SELECT
  USING (is_approved OR auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS reviews_admin_update ON public.customer_reviews;
CREATE POLICY reviews_admin_update ON public.customer_reviews FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS customer_reviews_admin_update ON public.customer_reviews;
CREATE POLICY customer_reviews_admin_update ON public.customer_reviews FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS sms_logs_admin_read ON public.sms_logs;
CREATE POLICY sms_logs_admin_read ON public.sms_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS holds_self_read ON public.booking_holds;
CREATE POLICY holds_self_read ON public.booking_holds FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS revenue_admin_read ON public.revenue_records;
CREATE POLICY revenue_admin_read ON public.revenue_records FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS calendar_connections_admin_read ON public.calendar_connections;
CREATE POLICY calendar_connections_admin_read ON public.calendar_connections FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS admin_settings_admin_update ON public.admin_settings;
CREATE POLICY admin_settings_admin_update ON public.admin_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS booking_audit_admin_all ON public.booking_audit_log;
CREATE POLICY booking_audit_admin_all ON public.booking_audit_log FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
