-- A new applicant must not be able to pre-populate reviewer-only attestation fields.
-- The review RPC is the only supported path that writes these values.
drop policy if exists professional_service_applications_owner_insert
  on public.professional_service_applications;

create policy professional_service_applications_owner_insert
  on public.professional_service_applications
  for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and exists (
      select 1
      from public.talent_profiles tp
      where tp.id = (select auth.uid())
    )
    and exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = public.professional_service_applications.subcategory_id
        and sc.is_active = true
        and c.is_active = true
        and public.professional_service_applications.delivery_modes <@ sc.delivery_modes
    )
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
    and verification_note is null
    and verification_checked_by is null
    and verification_checked_at is null
    and (
      credential_document_path is null
      or credential_document_path like ((select auth.uid())::text || '/%')
    )
    and (
      supporting_document_path is null
      or supporting_document_path like ((select auth.uid())::text || '/%')
    )
  );

comment on policy professional_service_applications_owner_insert
  on public.professional_service_applications is
  'Applicant inserts are owner-scoped, restricted to active taxonomy and allowed delivery modes, and cannot forge Admin review or verification attestation fields.';
