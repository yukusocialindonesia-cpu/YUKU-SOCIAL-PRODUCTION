-- Keep public professional listing checks independent from private users-table grants.
create or replace function private.is_active_approved_professional_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.talent_profiles tp on tp.id = u.id
    where u.id = p_provider_id
      and u.account_status::text = 'active'
      and tp.is_approved = true
  );
$$;

revoke all on function private.is_active_approved_professional_provider(uuid)
  from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_active_approved_professional_provider(uuid)
  to anon, authenticated;

drop policy if exists professional_talent_services_public_read
  on public.professional_talent_services;
create policy professional_talent_services_public_read
  on public.professional_talent_services
  for select to anon, authenticated
  using (
    approval_status = 'approved'
    and is_active = true
    and private.is_active_approved_professional_provider(provider_id)
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
