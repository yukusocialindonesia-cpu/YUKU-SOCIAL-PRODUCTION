-- Professional-only providers are valid YUKU accounts; a Talent profile is not a prerequisite.
-- Keep uploads private, owner-scoped, and limited to active accounts.
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
  );

comment on policy professional_service_documents_owner_upload
  on storage.objects is
  'Private professional evidence uploads are restricted to the authenticated owner folder and active accounts. A Talent profile is not required for professional-only providers.';
