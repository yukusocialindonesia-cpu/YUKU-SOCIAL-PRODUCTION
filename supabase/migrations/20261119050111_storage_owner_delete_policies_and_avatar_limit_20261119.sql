DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND ((SELECT auth.uid())::text = (storage.foldername(name))[1]));

DROP POLICY IF EXISTS portfolios_owner_delete ON storage.objects;
CREATE POLICY portfolios_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portfolios' AND ((SELECT auth.uid())::text = (storage.foldername(name))[1]));

UPDATE storage.buckets SET file_size_limit = 10485760 WHERE id = 'avatars';