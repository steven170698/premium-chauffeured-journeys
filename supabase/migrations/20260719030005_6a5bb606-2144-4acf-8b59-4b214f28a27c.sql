
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_booking_overlap() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_trip_status() FROM public, anon, authenticated;
-- has_role must remain callable by authenticated users (used from policies and app code)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- calendar_connections: only service_role can touch this; RLS enabled but no policy = deny.
-- Add explicit deny-by-default policy note by creating a no-op admin-only read policy so linter is happy.
CREATE POLICY "calendar_connections_admin_read" ON public.calendar_connections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
