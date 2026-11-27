-- Persist the Customer selfie evidence path alongside the KTP document.
-- The existing ktp-documents bucket is private and its role-scoped SELECT policy
-- already authorizes the owning user and Support/Talent reviewers.
alter table public.user_identities
  add column if not exists selfie_storage_path text;

comment on column public.user_identities.selfie_storage_path is
  'Private Storage object path for the Customer identity selfie holding their e-KTP; never store a public URL.';

-- Permit a user to remove only their own orphaned KTP/selfie upload.
-- Referenced identity evidence remains undeletable through the Storage API.
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ktp_documents_owner_delete_unreferenced'
  ) then
    create policy ktp_documents_owner_delete_unreferenced
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'ktp-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
        and not exists (
          select 1
          from public.user_identities ui
          where ui.id = auth.uid()
            and (
              ui.ktp_storage_path = objects.name
              or ui.selfie_storage_path = objects.name
            )
        )
      );
  end if;
end
$policy$;
