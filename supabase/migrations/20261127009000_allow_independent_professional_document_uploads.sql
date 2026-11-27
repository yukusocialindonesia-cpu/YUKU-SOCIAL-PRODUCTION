-- Phase G: professional evidence uploads must not require a Companion/Talent row.
-- The earlier storage policy was tightened to require talent_profiles, which blocks
-- valid Professional-only providers. Keep active-account, owner-folder, private-bucket,
-- MIME and size restrictions while checking the independent provider profile instead.

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
      from public.professional_provider_profiles p
      where p.user_id = (select auth.uid())
        and p.is_profile_complete = true
    )
  );

comment on policy professional_service_documents_owner_upload
  on storage.objects is
  'Private evidence upload for active users with a complete independent Professional Provider profile; Companion/Talent profile is not required.';
