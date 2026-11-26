-- Enforce that applicants can only offer delivery modes supported by the selected service type.
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
      where sc.id = subcategory_id
        and sc.is_active = true
        and c.is_active = true
        and delivery_modes <@ sc.delivery_modes
    )
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
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
  )
  with check (
    applicant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
    and exists (
      select 1 from public.talent_profiles tp
      where tp.id = (select auth.uid())
    )
    and exists (
      select 1
      from public.professional_service_subcategories sc
      join public.professional_service_categories c on c.id = sc.category_id
      where sc.id = subcategory_id
        and sc.is_active = true
        and c.is_active = true
        and delivery_modes <@ sc.delivery_modes
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

create or replace function public.admin_review_professional_service_application(
  p_application_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.professional_service_applications%rowtype;
  v_profile_approved boolean;
  v_verification_level text;
  v_allowed_modes text[];
begin
  if auth.uid() is null or not public.has_admin_permission('talent') then
    raise exception 'Akses admin Talent diperlukan.' using errcode = '42501';
  end if;

  if p_decision not in ('under_review','approved','rejected','needs_revision') then
    raise exception 'Keputusan pemeriksaan tidak valid.' using errcode = '22023';
  end if;

  select *
    into v_application
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
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'professional-service-documents'
        and o.name = v_application.credential_document_path
    )
  ) then
    raise exception 'Dokumen kompetensi tidak ditemukan di folder privat pemohon.' using errcode = '22023';
  end if;

  if v_application.supporting_document_path is not null and (
    v_application.supporting_document_path not like (v_application.applicant_id::text || '/%')
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'professional-service-documents'
        and o.name = v_application.supporting_document_path
    )
  ) then
    raise exception 'Dokumen pendukung tidak ditemukan di folder privat pemohon.' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    select tp.is_approved, sc.verification_level, sc.delivery_modes
      into v_profile_approved, v_verification_level, v_allowed_modes
      from public.talent_profiles tp
      join public.professional_service_subcategories sc
        on sc.id = v_application.subcategory_id
      join public.professional_service_categories c
        on c.id = sc.category_id
     where tp.id = v_application.applicant_id
       and sc.is_active = true
       and c.is_active = true;

    if coalesce(v_profile_approved, false) is not true then
      raise exception 'Profil Talent dan kategori layanan harus aktif/disetujui.' using errcode = '55000';
    end if;

    if not (v_application.delivery_modes <@ coalesce(v_allowed_modes, array[]::text[])) then
      raise exception 'Metode layanan tidak sesuai dengan jenis jasa yang dipilih.' using errcode = '22023';
    end if;

    if v_verification_level in ('credential','license')
       and v_application.credential_document_path is null then
      raise exception 'Dokumen kompetensi atau izin profesi wajib tersedia.' using errcode = '55000';
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
         admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   where id = p_application_id;

  return jsonb_build_object('success', true, 'application_id', p_application_id, 'status', p_decision);
end;
$$;

revoke all on function public.admin_review_professional_service_application(uuid, text, text) from public, anon;
grant execute on function public.admin_review_professional_service_application(uuid, text, text) to authenticated;
