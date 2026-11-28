-- Private evidence uploads are limited to active users who already have a Talent profile.
-- Bucket-level MIME and 10 MB limits remain enforced by Supabase Storage.
drop policy if exists professional_service_documents_owner_upload
  on storage.objects;
create policy professional_service_documents_owner_upload
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'professional-service-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.account_status::text = 'active'
    )
    and exists (
      select 1
      from public.talent_profiles tp
      where tp.id = (select auth.uid())
    )
  );

comment on policy professional_service_documents_owner_upload
  on storage.objects is
  'Private professional evidence uploads are restricted to the authenticated owner folder and an active account with a Talent profile.';
