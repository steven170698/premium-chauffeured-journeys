
REVOKE EXECUTE ON FUNCTION public.record_booking_revenue() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_booking_overlap() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_trip_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
-- mark_abandoned_bookings stays callable by authenticated (admins invoke it)
