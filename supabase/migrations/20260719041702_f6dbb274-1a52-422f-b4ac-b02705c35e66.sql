
-- 1. Extend enum
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'payment_expired';

-- 2. Booking columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS approval_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz;

-- 3. Admin settings columns
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS hold_during_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_window_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS auto_confirm_future_bookings boolean NOT NULL DEFAULT false;

-- Reasonable defaults for existing row
UPDATE public.admin_settings
SET approval_deadline_minutes = COALESCE(approval_deadline_minutes, 30)
WHERE id = 1;
UPDATE public.admin_settings SET approval_deadline_minutes = 30 WHERE id = 1 AND approval_deadline_minutes > 240;
