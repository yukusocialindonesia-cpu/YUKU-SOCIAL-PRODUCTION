-- Only active YUKU accounts may submit or publish professional-service listings.
-- Pending-verification accounts can still complete account onboarding, but cannot expose a service.

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

create or replace function public.guard_professional_talent_service_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approval_status = 'approved' and new.is_active then
    if not exists (
      select 1
      from public.talent_profiles tp
      join public.users u on u.id = tp.id
      where tp.id = new.provider_id
        and tp.is_approved = true
        and u.account_status::text = 'active'
    ) then
      raise exception 'Akun penyedia harus aktif dan profil Talent harus disetujui sebelum layanan dipublikasikan.'
        using errcode = '55000';
    end if;

    if not exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = new.subcategory_id
        and sc.is_active = true
        and c.is_active = true
        and new.delivery_modes <@ sc.delivery_modes
    ) then
      raise exception 'Kategori, jenis jasa, atau metode layanan tidak lagi memenuhi syarat publikasi.'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_professional_talent_service_publication()
  from public, anon, authenticated;

drop policy if exists professional_talent_services_public_read
  on public.professional_talent_services;
create policy professional_talent_services_public_read
  on public.professional_talent_services
  for select to anon, authenticated
  using (
    approval_status = 'approved'
    and is_active = true
    and exists (
      select 1
      from public.talent_profiles tp
      join public.users u on u.id = tp.id
      join public.professional_service_subcategories sc
        on sc.id = professional_talent_services.subcategory_id
      join public.professional_service_categories c
        on c.id = sc.category_id
      where tp.id = professional_talent_services.provider_id
        and tp.is_approved = true
        and u.account_status::text = 'active'
        and sc.is_active = true
        and c.is_active = true
        and professional_talent_services.delivery_modes <@ sc.delivery_modes
    )
  );

comment on policy professional_talent_services_public_read
  on public.professional_talent_services is
  'Public reads require an active account, approved Talent profile and listing, active taxonomy, and supported delivery modes.';
