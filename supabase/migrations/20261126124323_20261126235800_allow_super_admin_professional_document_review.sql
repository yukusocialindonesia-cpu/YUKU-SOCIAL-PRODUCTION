-- Align row and private-document read policies with the review RPC and Admin UI.
-- Super Admin is an explicitly supported reviewer even without a separate Talent permission.

drop policy if exists professional_service_applications_admin_read
  on public.professional_service_applications;
create policy professional_service_applications_admin_read
  on public.professional_service_applications
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_admin_permission('talent')
  );

drop policy if exists professional_service_documents_owner_read
  on storage.objects;
create policy professional_service_documents_owner_read
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'professional-service-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_super_admin()
      or public.has_admin_permission('talent')
    )
  );

comment on policy professional_service_applications_admin_read
  on public.professional_service_applications is
  'Applicants read only their own submissions; Talent-permission admins and Super Admins can read submissions for review.';

comment on policy professional_service_documents_owner_read
  on storage.objects is
  'Private evidence is readable only by its owner, Talent-permission admins, or Super Admins through authenticated access.';
