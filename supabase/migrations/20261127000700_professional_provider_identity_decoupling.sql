-- Independent Professional Provider identity.
-- This migration is additive to the existing Talent domain. It does not alter public.users.role.
-- Apply only in a reviewed staging migration after the PR stack is reconciled.

create table if not exists public.professional_provider_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name varchar(100) not null,
  avatar_url text,
  city varchar(120),
  headline varchar(200),
  bio text,
  is_profile_complete boolean not null default false,
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review','approved','suspended')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_professional_provider_profiles_public
  on public.professional_provider_profiles(review_status, city)
  where review_status = 'approved' and is_profile_complete = true;

alter table public.professional_provider_profiles enable row level security;

drop policy if exists professional_provider_profiles_owner_read
  on public.professional_provider_profiles;
create policy professional_provider_profiles_owner_read
  on public.professional_provider_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists professional_provider_profiles_owner_insert
  on public.professional_provider_profiles;
create policy professional_provider_profiles_owner_insert
  on public.professional_provider_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and review_status = 'pending_review'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status = 'active'::public.account_status_type
    )
  );

drop policy if exists professional_provider_profiles_owner_update
  on public.professional_provider_profiles;
create policy professional_provider_profiles_owner_update
  on public.professional_provider_profiles
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status = 'active'::public.account_status_type
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status = 'active'::public.account_status_type
    )
  );

drop policy if exists professional_provider_profiles_admin_read
  on public.professional_provider_profiles;
create policy professional_provider_profiles_admin_read
  on public.professional_provider_profiles
  for select to authenticated
  using (public.is_super_admin() or public.has_admin_permission('talent'));

-- Existing Professional listings used talent_profiles as their provider identity.
-- Preserve the provider UUID while changing the referenced identity table.
alter table public.professional_talent_services
  drop constraint if exists professional_talent_services_provider_id_fkey;

-- Preserve legacy profile details for any existing Professional listing/applicant.
insert into public.professional_provider_profiles (
  user_id, display_name, avatar_url, city, headline, bio,
  is_profile_complete, review_status, reviewed_at
)
select
  u.id,
  coalesce(nullif(tp.display_name, ''), nullif(u.full_name, ''), 'Penyedia Profesional'),
  tp.avatar_url,
  tp.city,
  tp.headline,
  tp.bio,
  (tp.id is not null and nullif(tp.display_name, '') is not null
    and nullif(tp.city, '') is not null and nullif(tp.headline, '') is not null
    and nullif(tp.bio, '') is not null),
  case
    when exists (
      select 1 from public.professional_talent_services pts
      where pts.provider_id = u.id
        and pts.approval_status = 'approved'
        and pts.is_active = true
    ) then 'approved'
    else 'pending_review'
  end,
  case when exists (
    select 1 from public.professional_talent_services pts
    where pts.provider_id = u.id
      and pts.approval_status = 'approved'
      and pts.is_active = true
  ) then now() else null end
from public.users u
left join public.talent_profiles tp on tp.id = u.id
where exists (
  select 1 from public.professional_service_applications a where a.applicant_id = u.id
) or exists (
  select 1 from public.professional_talent_services pts where pts.provider_id = u.id
)
on conflict (user_id) do nothing;

alter table public.professional_talent_services
  add constraint professional_talent_services_provider_id_fkey
  foreign key (provider_id)
  references public.professional_provider_profiles(user_id)
  on delete cascade;

-- A profile edit cannot self-approve or retain approval after changing public identity details.
create or replace function public.guard_professional_provider_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.user_id then
    if new.user_id <> old.user_id then
      raise exception 'ID penyedia tidak dapat diubah.' using errcode = '42501';
    end if;

    if new.display_name is distinct from old.display_name
       or new.avatar_url is distinct from old.avatar_url
       or new.city is distinct from old.city
       or new.headline is distinct from old.headline
       or new.bio is distinct from old.bio
       or new.is_profile_complete is distinct from old.is_profile_complete then
      new.review_status := 'pending_review';
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.review_status := old.review_status;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_professional_provider_profile_update()
  from public, anon, authenticated;

drop trigger if exists trg_guard_professional_provider_profile_update
  on public.professional_provider_profiles;
create trigger trg_guard_professional_provider_profile_update
before update on public.professional_provider_profiles
for each row execute function public.guard_professional_provider_profile_update();

-- Professional applications no longer require a Talent profile.
drop policy if exists professional_service_applications_owner_insert
  on public.professional_service_applications;
create policy professional_service_applications_owner_insert
  on public.professional_service_applications
  for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status = 'active'::public.account_status_type
        and u.is_verified_18 is true
    )
    and exists (
      select 1 from public.user_identities ui
      where ui.id = (select auth.uid())
        and ui.ktp_verification_status = 'verified'::public.ktp_status_type
    )
    and exists (
      select 1 from public.professional_provider_profiles pp
      where pp.user_id = (select auth.uid())
        and pp.is_profile_complete = true
        and pp.review_status in ('pending_review','approved')
    )
    and exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = professional_service_applications.subcategory_id
        and sc.is_active = true and c.is_active = true
        and professional_service_applications.delivery_modes <@ sc.delivery_modes
    )
    and status = 'pending'
    and reviewed_by is null and reviewed_at is null and admin_note is null
    and verification_note is null
    and verification_checked_by is null and verification_checked_at is null
    and (credential_document_path is null
      or credential_document_path like ((select auth.uid())::text || '/%'))
    and (supporting_document_path is null
      or supporting_document_path like ((select auth.uid())::text || '/%'))
  );

-- Applicants may revise only their own returned application. This replaces the legacy
-- policy that still required a Talent profile.
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
        and u.account_status = 'active'::public.account_status_type
        and u.is_verified_18 is true
    )
  )
  with check (
    applicant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null and reviewed_at is null and admin_note is null
    and verification_note is null
    and verification_checked_by is null and verification_checked_at is null
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.account_status = 'active'::public.account_status_type
        and u.is_verified_18 is true
    )
    and exists (
      select 1 from public.user_identities ui
      where ui.id = (select auth.uid())
        and ui.ktp_verification_status = 'verified'::public.ktp_status_type
    )
    and exists (
      select 1 from public.professional_provider_profiles pp
      where pp.user_id = (select auth.uid())
        and pp.is_profile_complete = true
        and pp.review_status in ('pending_review','approved')
    )
    and exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = professional_service_applications.subcategory_id
        and sc.is_active = true and c.is_active = true
        and professional_service_applications.delivery_modes <@ sc.delivery_modes
    )
    and (credential_document_path is null
      or credential_document_path like ((select auth.uid())::text || '/%'))
    and (supporting_document_path is null
      or supporting_document_path like ((select auth.uid())::text || '/%'))
  );

-- Only the transactional review RPC may promote a provider profile to approved.
create or replace function public.admin_review_professional_service_application(
  p_application_id uuid,
  p_decision text,
  p_admin_note text default null,
  p_verification_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.professional_service_applications%rowtype;
  v_profile public.professional_provider_profiles%rowtype;
  v_verification_level text;
  v_allowed_modes text[];
  v_account_active boolean;
  v_identity_verified boolean;
begin
  if auth.uid() is null
     or not (public.is_super_admin() or public.has_admin_permission('talent')) then
    raise exception 'Akses admin Talent diperlukan.' using errcode = '42501';
  end if;

  if p_decision not in ('under_review','approved','rejected','needs_revision') then
    raise exception 'Keputusan pemeriksaan tidak valid.' using errcode = '22023';
  end if;

  select * into v_application
    from public.professional_service_applications
   where id = p_application_id
   for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_application.status not in ('pending','under_review','needs_revision') then
    raise exception 'Pengajuan ini sudah diputuskan dan tidak dapat diproses ulang.' using errcode = '55000';
  end if;

  select * into v_profile
    from public.professional_provider_profiles
   where user_id = v_application.applicant_id
   for update;
  if not found or v_profile.is_profile_complete is not true then
    raise exception 'Profil Profesional belum lengkap.' using errcode = '55000';
  end if;

  if v_application.credential_document_path is not null and (
    v_application.credential_document_path not like (v_application.applicant_id::text || '/%')
    or not exists (select 1 from storage.objects o
      where o.bucket_id = 'professional-service-documents'
        and o.name = v_application.credential_document_path)
  ) then
    raise exception 'Dokumen kompetensi tidak ditemukan di folder privat pemohon.' using errcode = '22023';
  end if;
  if v_application.supporting_document_path is not null and (
    v_application.supporting_document_path not like (v_application.applicant_id::text || '/%')
    or not exists (select 1 from storage.objects o
      where o.bucket_id = 'professional-service-documents'
        and o.name = v_application.supporting_document_path)
  ) then
    raise exception 'Dokumen pendukung tidak ditemukan di folder privat pemohon.' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    if char_length(trim(coalesce(p_verification_note,''))) < 20 then
      raise exception 'Catatan verifikasi wajib minimal 20 karakter sebelum layanan dipublikasikan.' using errcode = '22023';
    end if;

    select
      (u.account_status = 'active'::public.account_status_type and u.is_verified_18 is true),
      (ui.ktp_verification_status = 'verified'::public.ktp_status_type),
      sc.verification_level,
      sc.delivery_modes
    into v_account_active, v_identity_verified, v_verification_level, v_allowed_modes
    from public.users u
    join public.user_identities ui on ui.id = u.id
    join public.professional_service_subcategories sc on sc.id = v_application.subcategory_id
    join public.professional_service_categories c on c.id = sc.category_id and c.is_active = true
    where u.id = v_application.applicant_id
      and sc.is_active = true;

    if coalesce(v_account_active,false) is not true
       or coalesce(v_identity_verified,false) is not true then
      raise exception 'Akun aktif, verifikasi usia, dan verifikasi KTP wajib sebelum publikasi.' using errcode = '55000';
    end if;
    if not (v_application.delivery_modes <@ coalesce(v_allowed_modes,array[]::text[])) then
      raise exception 'Metode layanan tidak lagi sesuai dengan kategori jasa.' using errcode = '22023';
    end if;
    if v_verification_level in ('credential','license')
       and v_application.credential_document_path is null then
      raise exception 'Dokumen kompetensi atau izin profesi wajib tersedia.' using errcode = '55000';
    end if;
    if v_verification_level = 'reference'
       and v_application.supporting_document_path is null then
      raise exception 'Bukti pengalaman atau referensi wajib tersedia.' using errcode = '55000';
    end if;

    update public.professional_provider_profiles
       set review_status = 'approved',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     where user_id = v_application.applicant_id;

    insert into public.professional_talent_services (
      provider_id, subcategory_id, service_description, experience_years,
      service_city, delivery_modes, rate_amount, pricing_unit,
      approval_status, is_active, reviewed_at
    ) values (
      v_application.applicant_id, v_application.subcategory_id,
      v_application.service_description, v_application.experience_years,
      v_application.service_city, v_application.delivery_modes,
      v_application.rate_amount, v_application.pricing_unit,
      'approved', true, now()
    )
    on conflict (provider_id, subcategory_id) do update
      set service_description = excluded.service_description,
          experience_years = excluded.experience_years,
          service_city = excluded.service_city,
          delivery_modes = excluded.delivery_modes,
          rate_amount = excluded.rate_amount,
          pricing_unit = excluded.pricing_unit,
          approval_status = 'approved',
          is_active = true,
          reviewed_at = now(),
          updated_at = now();
  end if;

  update public.professional_service_applications
     set status = p_decision,
         admin_note = nullif(trim(coalesce(p_admin_note,'')), ''),
         verification_note = case when p_decision = 'approved' then trim(p_verification_note) else verification_note end,
         verification_checked_by = case when p_decision = 'approved' then auth.uid() else verification_checked_by end,
         verification_checked_at = case when p_decision = 'approved' then now() else verification_checked_at end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   where id = p_application_id;

  return jsonb_build_object('success',true,'application_id',p_application_id,'status',p_decision);
end;
$$;

revoke all on function public.admin_review_professional_service_application(uuid,text,text,text)
  from public, anon;
grant execute on function public.admin_review_professional_service_application(uuid,text,text,text)
  to authenticated;

-- Public visibility is now independent of talent_profiles and users.role = 'talent'.
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
    join public.professional_provider_profiles pp on pp.user_id = u.id
    where u.id = p_talent_id
      and u.account_status = 'active'::public.account_status_type
      and u.is_verified_18 is true
      and ui.ktp_verification_status = 'verified'::public.ktp_status_type
      and pp.is_profile_complete is true
      and pp.review_status = 'approved'
  );
$$;

revoke all on function private.is_professional_talent_publicly_visible(uuid)
  from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_professional_talent_publicly_visible(uuid)
  to anon, authenticated;

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
        and sc.is_active = true and c.is_active = true
        and professional_talent_services.delivery_modes <@ sc.delivery_modes
    )
  );

drop policy if exists professional_provider_profiles_public_read
  on public.professional_provider_profiles;
create policy professional_provider_profiles_public_read
  on public.professional_provider_profiles
  for select to anon, authenticated
  using (
    review_status = 'approved'
    and is_profile_complete = true
    and private.is_professional_talent_publicly_visible(user_id)
    and exists (
      select 1 from public.professional_talent_services pts
      where pts.provider_id = professional_provider_profiles.user_id
        and pts.approval_status = 'approved'
        and pts.is_active = true
    )
  );

drop policy if exists talent_profiles_professional_service_public_read
  on public.talent_profiles;

create or replace function public.guard_professional_talent_service_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approval_status = 'approved' and new.is_active then
    if not private.is_professional_talent_publicly_visible(new.provider_id) then
      raise exception 'Profil Profesional harus aktif, terverifikasi, dan disetujui sebelum layanan dipublikasikan.'
        using errcode = '55000';
    end if;
    if not exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = new.subcategory_id
        and sc.is_active = true and c.is_active = true
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

comment on table public.professional_provider_profiles is
  'Independent Professional Services identity. Does not require a Talent profile or users.role=talent.';
comment on function private.is_professional_talent_publicly_visible(uuid) is
  'Boolean-only public eligibility gate for independent Professional Provider profiles; requires active account, verified age/KTP, complete and approved Professional profile.';
