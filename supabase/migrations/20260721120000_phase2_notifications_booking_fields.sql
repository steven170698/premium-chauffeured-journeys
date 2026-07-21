-- =====================================================================
-- Stevie Services LLC — Phase 2 migration
-- In-app notifications, email logs, support requests, multi-stop, and
-- additional booking fields.
-- =====================================================================
-- SAFE, ADDITIVE, REVERSIBLE:
--   * Only CREATE ... IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
--   * No existing table, column, policy, trigger, index, or function is
--     dropped, renamed, or altered.
--   * Reuses existing helpers: public.has_role(uuid, app_role) and
--     public.set_updated_at().
--   * Row Level Security is enabled ONLY on the four new tables.
--   * Idempotent — safe to run more than once.
-- Rollback: see the commented block at the bottom.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. bookings — additional fields (all nullable or defaulted; no data loss)
-- ---------------------------------------------------------------------
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

-- One-time, safe backfill of the NEW trip_type column from the existing flag.
UPDATE public.bookings
   SET trip_type = CASE WHEN is_round_trip THEN 'round_trip' ELSE 'one_way' END
 WHERE trip_type = 'one_way';

-- Duplicate-submission guard (double-click / retry). Only enforced when a key
-- is supplied, so existing rows (NULL key) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_key_uidx
  ON public.bookings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. booking_stops — structured multi-stop routing
--    (the existing free-text bookings.extra_stops column is preserved)
-- ---------------------------------------------------------------------
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
CREATE INDEX IF NOT EXISTS booking_stops_booking_idx
  ON public.booking_stops (booking_id, position);

ALTER TABLE public.booking_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_stops_select_own_or_admin" ON public.booking_stops;
CREATE POLICY "booking_stops_select_own_or_admin" ON public.booking_stops
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_stops.booking_id
        AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
-- Inserts/updates happen server-side via the service role (bypasses RLS).

-- ---------------------------------------------------------------------
-- 3. notifications — in-app feed
--    (distinct from the existing notification_preferences table)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,                                   -- recipient (NULL = role broadcast)
  audience    text NOT NULL DEFAULT 'customer',       -- customer | admin | driver
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  is_read     boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx    ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx  ON public.notifications (user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_select_own_or_admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "notifications_update_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_update_own_or_admin" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Inserts happen server-side via the service role.

-- ---------------------------------------------------------------------
-- 4. email_logs — delivery log (mirrors the existing sms_logs table)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id       uuid,
  event_type    text NOT NULL DEFAULT 'generic',
  recipient     text NOT NULL,
  subject       text,
  status        text NOT NULL DEFAULT 'sent',          -- sent | skipped | failed
  provider_id   text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_logs_booking_idx ON public.email_logs (booking_id);
CREATE INDEX IF NOT EXISTS email_logs_event_idx   ON public.email_logs (event_type, created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_logs_admin_read" ON public.email_logs;
CREATE POLICY "email_logs_admin_read" ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- Inserts happen server-side via the service role.

-- ---------------------------------------------------------------------
-- 5. support_requests — contact-form / support messages
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new',             -- new | in_progress | waiting | resolved | closed
  source      text NOT NULL DEFAULT 'contact_form',
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id     uuid,
  assigned_to uuid,
  admin_notes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requests_status_idx
  ON public.support_requests (status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_requests_admin_all" ON public.support_requests;
CREATE POLICY "support_requests_admin_all" ON public.support_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "support_requests_insert_authenticated" ON public.support_requests;
CREATE POLICY "support_requests_insert_authenticated" ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);
-- Public (anonymous) contact-form submissions are inserted server-side via the service role.

DROP TRIGGER IF EXISTS trg_support_requests_updated ON public.support_requests;
CREATE TRIGGER trg_support_requests_updated BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- =====================================================================
-- ROLLBACK — reverse this migration. Uncomment and run to undo.
-- NOTE: dropping the new tables removes any rows created in them after
-- this migration. The bookings columns are additive; dropping them
-- removes only the new columns' data, never existing booking data.
-- =====================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_support_requests_updated ON public.support_requests;
-- DROP TABLE IF EXISTS public.support_requests;
-- DROP TABLE IF EXISTS public.email_logs;
-- DROP TABLE IF EXISTS public.notifications;
-- DROP TABLE IF EXISTS public.booking_stops;
-- DROP INDEX IF EXISTS public.bookings_idempotency_key_uidx;
-- ALTER TABLE public.bookings
--   DROP COLUMN IF EXISTS first_name,
--   DROP COLUMN IF EXISTS last_name,
--   DROP COLUMN IF EXISTS trip_type,
--   DROP COLUMN IF EXISTS flight_number,
--   DROP COLUMN IF EXISTS airline,
--   DROP COLUMN IF EXISTS airport_terminal,
--   DROP COLUMN IF EXISTS meet_and_greet,
--   DROP COLUMN IF EXISTS child_seat,
--   DROP COLUMN IF EXISTS accessibility_request,
--   DROP COLUMN IF EXISTS hourly_hours,
--   DROP COLUMN IF EXISTS pickup_place_id,
--   DROP COLUMN IF EXISTS destination_place_id,
--   DROP COLUMN IF EXISTS decline_reason,
--   DROP COLUMN IF EXISTS approved_by,
--   DROP COLUMN IF EXISTS declined_by,
--   DROP COLUMN IF EXISTS booking_source,
--   DROP COLUMN IF EXISTS idempotency_key;
-- COMMIT;
