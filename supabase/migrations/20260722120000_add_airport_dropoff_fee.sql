-- Airport DROP-OFF fee, distinct from `airport_surcharge` (the airport PICKUP fee).
-- Read directly from admin_settings by the service-role quote path (quote.server.ts),
-- written by the admin Settings UI (updateAdminSettings in admin.functions.ts).
-- The code already references this column; this migration adds it to the database.
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS airport_dropoff_fee numeric(10,2) NOT NULL DEFAULT 0;
