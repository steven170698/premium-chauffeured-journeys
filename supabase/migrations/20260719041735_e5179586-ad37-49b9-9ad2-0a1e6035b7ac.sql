
-- Rewrite overlap trigger
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  new_end TIMESTAMPTZ;
  hold_pending BOOLEAN;
BEGIN
  -- Non-blocking terminal statuses
  IF NEW.trip_status IN ('canceled','declined','payment_expired','completed') THEN
    RETURN NEW;
  END IF;

  new_end := COALESCE(NEW.estimated_end_at, NEW.pickup_at + INTERVAL '2 hours');

  SELECT hold_during_approval INTO hold_pending FROM public.admin_settings WHERE id = 1;
  hold_pending := COALESCE(hold_pending, true);

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id <> NEW.id
      AND b.trip_status NOT IN ('canceled','declined','payment_expired','completed')
      -- Ignore pending_approval rows past their deadline (or when hold is off)
      AND NOT (
        b.trip_status = 'pending_approval'
        AND (
          NOT hold_pending
          OR (b.approval_deadline_at IS NOT NULL AND b.approval_deadline_at < now())
        )
      )
      -- Ignore awaiting_payment rows past their payment deadline
      AND NOT (
        b.trip_status = 'awaiting_payment'
        AND b.payment_deadline_at IS NOT NULL
        AND b.payment_deadline_at < now()
      )
      AND tstzrange(b.pickup_at, COALESCE(b.estimated_end_at, b.pickup_at + INTERVAL '2 hours'), '[)')
          && tstzrange(NEW.pickup_at, new_end, '[)')
  ) THEN
    RAISE EXCEPTION 'Time slot conflicts with an existing booking';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.availability_status a
    WHERE a.status IN ('vacation','busy','offline','not_accepting')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(NEW.pickup_at, new_end, '[)')
  ) THEN
    RAISE EXCEPTION 'Driver is unavailable during this time slot';
  END IF;

  RETURN NEW;
END;
$function$;

-- Rewrite abandonment sweep
CREATE OR REPLACE FUNCTION public.mark_abandoned_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  affected integer := 0;
  tmp integer;
BEGIN
  UPDATE public.bookings
  SET trip_status = 'declined', declined_at = now()
  WHERE trip_status = 'pending_approval'
    AND approval_deadline_at IS NOT NULL
    AND approval_deadline_at < now();
  GET DIAGNOSTICS tmp = ROW_COUNT;
  affected := affected + tmp;

  UPDATE public.bookings
  SET trip_status = 'payment_expired'
  WHERE trip_status = 'awaiting_payment'
    AND payment_deadline_at IS NOT NULL
    AND payment_deadline_at < now();
  GET DIAGNOSTICS tmp = ROW_COUNT;
  affected := affected + tmp;

  RETURN affected;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_abandoned_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_bookings() TO service_role;
