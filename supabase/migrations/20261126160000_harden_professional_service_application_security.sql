-- Security hardening for professional-service applications and evidence retention.
-- This migration is additive and must be reviewed before applying to production.

-- Do not permit direct admin row edits that bypass the transactional review RPC.
drop policy if exists professional_service_applications_admin_update
  on public.professional_service_applications;

-- Only users who already have a Talent profile may submit a professional-service application.
-- Document paths must remain inside the applicant's own private folder.
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

-- Prevent applicants from deleting evidence while an application still references it.
drop policy if exists professional_service_documents_owner_delete
  on storage.objects;
create policy professional_service_documents_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'professional-service-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.professional_service_applications a
      where a.applicant_id = (select auth.uid())
        and (
          a.credential_document_path = objects.name
          or a.supporting_document_path = objects.name
        )
    )
  );

-- Prevent duplicate active applications for the same Talent and service type.
create unique index if not exists idx_professional_service_applications_one_open_per_type
  on public.professional_service_applications(applicant_id, subcategory_id)
  where status in ('pending','under_review','needs_revision');

-- Replace the review RPC with checks that referenced evidence exists in the private bucket
-- and is stored under the applicant's own folder before any listing can be published.
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
    select tp.is_approved, sc.verification_level
      into v_profile_approved, v_verification_level
      from public.talent_profiles tp
      join public.professional_service_subcategories sc
        on sc.id = v_application.subcategory_id
     where tp.id = v_application.applicant_id
       and sc.is_active = true;

    if coalesce(v_profile_approved, false) is not true then
      raise exception 'Profil Talent harus disetujui sebelum layanan dipublikasikan.' using errcode = '55000';
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

comment on function public.admin_review_professional_service_application(uuid, text, text) is
  'Admin-only transactional review. Verifies private evidence belongs to applicant and exists; approval publishes only for an approved Talent profile and active service type.';
