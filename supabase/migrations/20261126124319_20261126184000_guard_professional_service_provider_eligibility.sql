-- Final publication guard: prevent inactive/suspended accounts from being
-- published, even if an admin RPC or future code path attempts to write a listing.
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
        and coalesce(u.account_status::text, 'active') not in ('suspended', 'banned')
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

drop trigger if exists trg_guard_professional_talent_service_publication
  on public.professional_talent_services;
create trigger trg_guard_professional_talent_service_publication
before insert or update of provider_id, subcategory_id, delivery_modes, approval_status, is_active
on public.professional_talent_services
for each row execute function public.guard_professional_talent_service_publication();

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
        and coalesce(u.account_status::text, 'active') not in ('suspended', 'banned')
        and sc.is_active = true
        and c.is_active = true
        and professional_talent_services.delivery_modes <@ sc.delivery_modes
    )
  );

comment on function public.guard_professional_talent_service_publication() is
  'Database-level guard that prevents approved active professional listings for suspended/banned accounts, unapproved Talent profiles, inactive taxonomy, or unsupported delivery modes.';
