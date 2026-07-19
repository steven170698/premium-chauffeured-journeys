
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_notes text;

-- Update overlap check to also block against active availability_status rows
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  new_end TIMESTAMPTZ;
BEGIN
  IF NEW.trip_status = 'canceled' THEN RETURN NEW; END IF;
  new_end := COALESCE(NEW.estimated_end_at, NEW.pickup_at + INTERVAL '2 hours');
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id <> NEW.id
      AND b.trip_status <> 'canceled'
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
