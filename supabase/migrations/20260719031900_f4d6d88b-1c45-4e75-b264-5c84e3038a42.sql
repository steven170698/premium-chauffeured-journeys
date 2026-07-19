GRANT SELECT ON public.admin_settings TO anon;
CREATE POLICY admin_settings_read_public ON public.admin_settings FOR SELECT TO anon USING (true);