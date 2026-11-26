-- Phase B: allow an active account with an independent Professional Provider
-- profile to submit/revise applications. Companion/Talent profile is optional.
-- Admin approval/publication still remains guarded by the existing review RPC
-- until the dedicated Phase C migration replaces that RPC and listing FK.

drop policy if exists professional_service_applications_owner_insert
  on public.professional_service_applications;
create policy professional_service_applications_owner_insert
  on public.professional_service_applications
  for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
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
        and length(trim(p.display_name)) >= 2
        and length(trim(coalesce(p.city, ''))) >= 2
        and length(trim(coalesce(p.headline, ''))) >= 3
        and length(trim(coalesce(p.bio, ''))) >= 20
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

drop policy if exists professional_service_applications_owner_revision_update
  on public.professional_service_applications;
create policy professional_service_applications_owner_revision_update
  on public.professional_service_applications
  for update to authenticated
  using (
    applicant_id = (select auth.uid())
    and status = 'needs_revision'
    and exists (
      select 1
      from public.users u
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
        and length(trim(p.display_name)) >= 2
        and length(trim(coalesce(p.city, ''))) >= 2
        and length(trim(coalesce(p.headline, ''))) >= 3
        and length(trim(coalesce(p.bio, ''))) >= 20
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
  'Active account with complete independent Professional Provider profile may submit; Companion/Talent profile is not required.';

comment on policy professional_service_applications_owner_revision_update
  on public.professional_service_applications is
  'Active applicant may resubmit a revision with complete independent Professional Provider profile; review attestations remain admin-controlled.';
