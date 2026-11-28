-- Prevent applicant revision updates from writing admin-only verification attestations.
drop policy if exists professional_service_applications_owner_revision_update
  on public.professional_service_applications;
create policy professional_service_applications_owner_revision_update
  on public.professional_service_applications
  for update to authenticated
  using (
    applicant_id = (select auth.uid())
    and status = 'needs_revision'
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status::text = 'active'
    )
  )
  with check (
    applicant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
    and verification_note is null
    and verification_checked_by is null
    and verification_checked_at is null
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status::text = 'active'
    )
    and exists (
      select 1 from public.talent_profiles tp
      where tp.id = (select auth.uid())
    )
    and exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = professional_service_applications.subcategory_id
        and sc.is_active = true
        and c.is_active = true
        and professional_service_applications.delivery_modes <@ sc.delivery_modes
    )
    and (
      credential_document_path is null
      or credential_document_path like ((select auth.uid())::text || '/%')
    )
    and (
      supporting_document_path is null
      or supporting_document_path like ((select auth.uid())::text || '/%')
    )
  );
