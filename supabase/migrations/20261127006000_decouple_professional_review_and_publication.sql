-- Phase C: decouple Professional Services review/publication from Companion profiles.
-- Additive compatibility: account IDs and listing IDs remain unchanged. This migration
-- is branch-only and must be tested against a production-like schema before release.

-- The Phase A backfill creates an independent provider profile for every existing
-- professional listing owner. Switch the listing FK only after that backfill.
alter table public.professional_talent_services
  drop constraint if exists professional_talent_services_provider_id_fkey;
alter table public.professional_talent_services
  add constraint professional_talent_services_provider_id_fkey
  foreign key (provider_id)
  references public.professional_provider_profiles(user_id)
  on delete cascade
  not valid;
alter table public.professional_talent_services
  validate constraint professional_talent_services_provider_id_fkey;

-- Transactional review remains the only route for publication. Companion approval
-- is deliberately not consulted; professional profile readiness and account status are.
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
  v_profile_complete boolean;
  v_account_status text;
  v_verification_level text;
  v_allowed_modes text[];
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

    select p.is_profile_complete, u.account_status::text, sc.verification_level, sc.delivery_modes
      into v_profile_complete, v_account_status, v_verification_level, v_allowed_modes
      from public.professional_provider_profiles p
      join public.users u on u.id = p.user_id
      join public.professional_service_subcategories sc on sc.id = v_application.subcategory_id
      join public.professional_service_categories c on c.id = sc.category_id and c.is_active = true
     where p.user_id = v_application.applicant_id
       and sc.is_active = true;

    if coalesce(v_profile_complete,false) is not true
       or coalesce(v_account_status,'') <> 'active' then
      raise exception 'Profil penyedia profesional harus lengkap dan akun harus aktif sebelum layanan dipublikasikan.' using errcode = '55000';
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
      raise exception 'Bukti pengalaman atau referensi wajib tersedia untuk jenis jasa ini.' using errcode = '55000';
    end if;

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
revoke all on function public.admin_review_professional_service_application(uuid,text,text)
  from public, anon, authenticated;
drop function if exists public.admin_review_professional_service_application(uuid,text,text);

-- Database guard and public listing policy now use the independent provider profile.
create or replace function public.guard_professional_talent_service_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approval_status = 'approved' and new.is_active then
    if not exists (
      select 1 from public.professional_provider_profiles p
      join public.users u on u.id = p.user_id
      where p.user_id = new.provider_id
        and p.is_profile_complete = true
        and u.account_status::text = 'active'
    ) then
      raise exception 'Profil profesional harus lengkap dan akun penyedia harus aktif.' using errcode = '55000';
    end if;
    if not exists (
      select 1 from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = new.subcategory_id and sc.is_active = true
        and c.is_active = true and new.delivery_modes <@ sc.delivery_modes
    ) then
      raise exception 'Kategori, jenis jasa, atau metode layanan tidak lagi memenuhi syarat publikasi.' using errcode = '55000';
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
    approval_status = 'approved' and is_active = true
    and exists (
      select 1
      from public.professional_provider_profiles p
      join public.users u on u.id = p.user_id
      join public.professional_service_subcategories sc on sc.id = professional_talent_services.subcategory_id
      join public.professional_service_categories c on c.id = sc.category_id
      where p.user_id = professional_talent_services.provider_id
        and p.is_profile_complete = true
        and u.account_status::text = 'active'
        and sc.is_active = true and c.is_active = true
        and professional_talent_services.delivery_modes <@ sc.delivery_modes
    )
  );

comment on function public.guard_professional_talent_service_publication() is
  'Publication guard for independent Professional Services providers; Companion/Talent profile is not required.';
