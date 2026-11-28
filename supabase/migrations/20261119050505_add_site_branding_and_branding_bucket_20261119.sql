CREATE TABLE IF NOT EXISTS public.site_branding (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  logo_path text,
  icon_path text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_branding_updated_by ON public.site_branding (updated_by);

ALTER TABLE public.site_branding ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.site_branding FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_branding TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_branding TO authenticated;

DROP POLICY IF EXISTS site_branding_read_all ON public.site_branding;
CREATE POLICY site_branding_read_all ON public.site_branding
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS site_branding_admin_insert ON public.site_branding;
CREATE POLICY site_branding_admin_insert ON public.site_branding
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS site_branding_admin_update ON public.site_branding;
CREATE POLICY site_branding_admin_update ON public.site_branding
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

INSERT INTO public.site_branding (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS branding_public_read ON storage.objects;
CREATE POLICY branding_public_read ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_admin_insert ON storage.objects;
CREATE POLICY branding_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS branding_admin_update ON storage.objects;
CREATE POLICY branding_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'branding' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS branding_admin_delete ON storage.objects;
CREATE POLICY branding_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (SELECT public.is_admin()));