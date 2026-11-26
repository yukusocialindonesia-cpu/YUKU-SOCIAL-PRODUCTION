-- Phase F: avoid recursive RLS evaluation between public provider profiles
-- and public professional listings. The SECURITY DEFINER helper reads both
-- tables as the migration/table owner, so their public policies do not recurse.

create or replace function public.professional_provider_has_public_listing(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.professional_talent_services pts
    join public.professional_provider_profiles p
      on p.user_id = pts.provider_id
    join public.users u
      on u.id = p.user_id
    join public.professional_service_subcategories sc
      on sc.id = pts.subcategory_id
    join public.professional_service_categories c
      on c.id = sc.category_id
    where pts.provider_id = p_user_id
      and pts.approval_status = 'approved'
      and pts.is_active = true
      and p.is_profile_complete = true
      and u.account_status::text = 'active'
      and sc.is_active = true
      and c.is_active = true
      and pts.delivery_modes <@ sc.delivery_modes
  );
$$;

revoke all on function public.professional_provider_has_public_listing(uuid)
  from public;
grant execute on function public.professional_provider_has_public_listing(uuid)
  to anon, authenticated;

drop policy if exists professional_provider_profiles_public_read
  on public.professional_provider_profiles;
create policy professional_provider_profiles_public_read
  on public.professional_provider_profiles
  for select to anon, authenticated
  using (
    public.professional_provider_has_public_listing(user_id)
  );

drop policy if exists professional_talent_services_public_read
  on public.professional_talent_services;
create policy professional_talent_services_public_read
  on public.professional_talent_services
  for select to anon, authenticated
  using (
    approval_status = 'approved'
    and is_active = true
    and public.professional_provider_has_public_listing(provider_id)
  );

comment on function public.professional_provider_has_public_listing(uuid) is
  'RLS-safe public eligibility check for independent Professional Services providers and listings.';
