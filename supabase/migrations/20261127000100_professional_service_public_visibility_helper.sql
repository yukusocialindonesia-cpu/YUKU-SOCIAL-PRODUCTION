-- Public professional-service discovery must not depend on querying users through
-- the caller's users-table RLS policy. Expose only a boolean eligibility check.
create or replace function private.is_professional_talent_publicly_visible(p_talent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.user_identities ui on ui.id = u.id
    join public.talent_profiles tp on tp.id = u.id
    where u.id = p_talent_id
      and u.role = 'talent'::public.user_role_type
      and u.account_status = 'active'::public.account_status_type
      and u.is_verified_18 is true
      and ui.ktp_verification_status = 'verified'::public.ktp_status_type
      and tp.is_approved is true
  );
$$;

revoke all on function private.is_professional_talent_publicly_visible(uuid)
  from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_professional_talent_publicly_visible(uuid)
  to anon, authenticated;

-- The listing policy calls the SECURITY DEFINER boolean helper, not a direct
-- SELECT against public.users, whose RLS intentionally hides other users.
drop policy if exists professional_talent_services_public_read
  on public.professional_talent_services;
create policy professional_talent_services_public_read
  on public.professional_talent_services
  for select to anon, authenticated
  using (
    approval_status = 'approved'
    and is_active = true
    and private.is_professional_talent_publicly_visible(provider_id)
    and exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = professional_talent_services.subcategory_id
        and sc.is_active = true
        and c.is_active = true
        and professional_talent_services.delivery_modes <@ sc.delivery_modes
    )
  );

-- Existing Talent profile visibility expects an approved standard talent_services
-- row. Professional-only providers need a narrowly-scoped equivalent read path.
drop policy if exists talent_profiles_professional_service_public_read
  on public.talent_profiles;
create policy talent_profiles_professional_service_public_read
  on public.talent_profiles
  for select to anon, authenticated
  using (
    private.is_professional_talent_publicly_visible(id)
    and exists (
      select 1
      from public.professional_talent_services pts
      where pts.provider_id = talent_profiles.id
        and pts.approval_status = 'approved'
        and pts.is_active = true
    )
  );

comment on function private.is_professional_talent_publicly_visible(uuid) is
  'Returns only a boolean. Public professional-service visibility requires an active Talent account, verified age and KTP, and an approved Talent profile.';

comment on policy professional_talent_services_public_read
  on public.professional_talent_services is
  'Public listing access is gated by the SECURITY DEFINER eligibility helper, active taxonomy, supported delivery mode, and approved active listing.';

comment on policy talent_profiles_professional_service_public_read
  on public.talent_profiles is
  'Public profile visibility is granted only while the provider has an approved active professional-service listing and passes the professional visibility helper.';
