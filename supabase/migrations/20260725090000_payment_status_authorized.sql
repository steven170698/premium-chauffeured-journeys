-- Payments are now authorised at checkout and captured only when the ride is
-- accepted (Stripe capture_method: manual). That needs a payment_status value
-- meaning "card held, money not taken yet".
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'authorized';
