-- Public listings must remain consistent with the currently active taxonomy.
-- This prevents an approved listing from remaining discoverable after its
-- service type/category is disabled or its delivery modes are no longer allowed.

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
      join public.professional_service_subcategories sc
        on sc.id = professional_talent_services.subcategory_id
      join public.professional_service_categories c
        on c.id = sc.category_id
      where tp.id = professional_talent_services.provider_id
        and tp.is_approved = true
        and sc.is_active = true
        and c.is_active = true
        and professional_talent_services.delivery_modes <@ sc.delivery_modes
    )
  );

comment on policy professional_talent_services_public_read
  on public.professional_talent_services is
  'Public reads require approved active provider, listing, subcategory and category, with delivery modes allowed by the current taxonomy.';
