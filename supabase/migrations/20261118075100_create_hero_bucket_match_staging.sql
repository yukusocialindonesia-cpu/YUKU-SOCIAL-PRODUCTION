INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('hero', 'hero', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS hero_bucket_admin_insert ON storage.objects;
DROP POLICY IF EXISTS hero_bucket_admin_update ON storage.objects;
DROP POLICY IF EXISTS hero_bucket_admin_delete ON storage.objects;
DROP POLICY IF EXISTS hero_bucket_admin_select ON storage.objects;

CREATE POLICY hero_bucket_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hero' AND (SELECT public.is_admin()));

CREATE POLICY hero_bucket_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'hero' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'hero' AND (SELECT public.is_admin()));

CREATE POLICY hero_bucket_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hero' AND (SELECT public.is_admin()));

CREATE POLICY hero_bucket_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hero' AND (SELECT public.is_admin()));