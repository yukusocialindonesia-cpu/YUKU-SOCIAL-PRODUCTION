-- Persist the Customer selfie evidence path alongside the KTP document.
-- The existing ktp-documents bucket is private and its role-scoped SELECT policy
-- already authorizes the owning user and Support/Talent reviewers.
alter table public.user_identities
  add column if not exists selfie_storage_path text;

comment on column public.user_identities.selfie_storage_path is
  'Private Storage object path for the Customer identity selfie holding their e-KTP; never store a public URL.';

-- Permit a user to remove only their own orphaned KTP/selfie upload.
-- Referenced identity evidence remains undeletable through the Storage API.
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ktp_documents_owner_delete_unreferenced'
  ) then
    create policy ktp_documents_owner_delete_unreferenced
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'ktp-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
        and not exists (
          select 1
          from public.user_identities ui
          where ui.ktp_storage_path = objects.name
             or ui.selfie_storage_path = objects.name
        )
      );
  end if;
end
$policy$;

-- Keep selfie evidence immutable while a Customer submission is under review or verified.
-- A rejected Customer may replace the KTP/selfie evidence and automatically resubmit.
create or replace function public.protect_and_verify_user_identities()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_has_customer_profile boolean;
  v_can_review boolean :=
    session_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.can_admin_access_ktp(new.id);
  v_has_required_evidence boolean;
begin
  select exists (
    select 1 from public.customer_profiles cp where cp.id = new.id
  ) into v_has_customer_profile;

  v_has_required_evidence :=
    new.ktp_number is not null
    and nullif(trim(coalesce(new.ktp_storage_path, '')), '') is not null
    and (
      not v_has_customer_profile
      or nullif(trim(coalesce(new.selfie_storage_path, '')), '') is not null
    );

  if tg_op = 'INSERT' then
    if not v_can_review then
      if v_has_required_evidence then
        new.ktp_verification_status := 'pending_review'::public.ktp_status_type;
      else
        new.ktp_verification_status := 'unsubmitted'::public.ktp_status_type;
      end if;
      new.ktp_rejection_reason := null;
      new.verified_at := null;
      new.verified_by_admin_id := null;
    end if;

  elsif tg_op = 'UPDATE' then
    if (
      new.ktp_verification_status is distinct from old.ktp_verification_status
      or new.ktp_rejection_reason is distinct from old.ktp_rejection_reason
      or new.verified_at is distinct from old.verified_at
      or new.verified_by_admin_id is distinct from old.verified_by_admin_id
    ) and not v_can_review then
      raise exception 'Akses Ditolak: Keputusan verifikasi KTP memerlukan izin Talent atau Support sesuai jenis akun.';
    end if;

    if not v_can_review
       and old.ktp_verification_status in (
         'pending_review'::public.ktp_status_type,
         'verified'::public.ktp_status_type
       ) then
      if new.full_legal_name is distinct from old.full_legal_name
         or new.date_of_birth is distinct from old.date_of_birth
         or new.ktp_number is distinct from old.ktp_number
         or new.ktp_storage_path is distinct from old.ktp_storage_path
         or new.selfie_storage_path is distinct from old.selfie_storage_path then
        raise exception 'Akses Ditolak: Data identitas legal yang sedang diproses atau sudah terverifikasi tidak dapat diubah sepihak.';
      end if;
    end if;

    if not v_can_review
       and old.ktp_verification_status = 'rejected'::public.ktp_status_type
       and (
         new.ktp_number is distinct from old.ktp_number
         or new.ktp_storage_path is distinct from old.ktp_storage_path
         or new.selfie_storage_path is distinct from old.selfie_storage_path
       ) then
      if v_has_required_evidence then
        new.ktp_verification_status := 'pending_review'::public.ktp_status_type;
        new.ktp_rejection_reason := null;
        new.verified_at := null;
        new.verified_by_admin_id := null;
      end if;
    end if;

    if not v_can_review
       and old.ktp_verification_status = 'unsubmitted'::public.ktp_status_type
       and v_has_required_evidence then
      new.ktp_verification_status := 'pending_review'::public.ktp_status_type;
    end if;
  end if;

  return new;
end;
$function$;

-- A Customer cannot be approved as verified without a valid, privately stored selfie.
create or replace function public.guard_ktp_verified_requires_valid_identity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_has_customer_profile boolean;
begin
  if new.ktp_verification_status = 'verified'::public.ktp_status_type then
    select exists (
    select 1 from public.customer_profiles cp where cp.id = new.id
  ) into v_has_customer_profile;

    if new.date_of_birth is null
       or new.date_of_birth > (current_date - interval '18 years')::date then
      raise exception 'KTP tidak dapat diverifikasi: pemilik harus berusia minimal 18 tahun.';
    end if;

    if nullif(trim(coalesce(new.full_legal_name, '')), '') is null
       or nullif(trim(coalesce(new.ktp_storage_path, '')), '') is null then
      raise exception 'KTP tidak dapat diverifikasi: nama legal, tanggal lahir, dan dokumen wajib tersedia.';
    end if;

    if left(new.ktp_storage_path, char_length(new.id::text || '/')) <> new.id::text || '/' then
      raise exception 'KTP tidak dapat diverifikasi: lokasi dokumen tidak sesuai dengan pemilik akun.';
    end if;

    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'ktp-documents'
        and o.name = new.ktp_storage_path
        and (o.owner = new.id or o.owner_id = new.id::text)
    ) then
      raise exception 'KTP tidak dapat diverifikasi: file tidak ditemukan atau bukan milik akun tersebut.';
    end if;

    if v_has_customer_profile then
      if nullif(trim(coalesce(new.selfie_storage_path, '')), '') is null
         or new.selfie_storage_path = new.ktp_storage_path then
        raise exception 'KTP Customer tidak dapat diverifikasi: selfie wajib tersedia sebagai dokumen terpisah.';
      end if;

      if left(new.selfie_storage_path, char_length(new.id::text || '/')) <> new.id::text || '/' then
        raise exception 'KTP Customer tidak dapat diverifikasi: lokasi selfie tidak sesuai dengan pemilik akun.';
      end if;

      if not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'ktp-documents'
          and o.name = new.selfie_storage_path
          and (o.owner = new.id or o.owner_id = new.id::text)
      ) then
        raise exception 'KTP Customer tidak dapat diverifikasi: selfie tidak ditemukan atau bukan milik akun tersebut.';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- Match the existing least-privilege column grants for identity evidence.
grant select (selfie_storage_path) on public.user_identities to authenticated;
grant insert (selfie_storage_path) on public.user_identities to authenticated;
grant update (selfie_storage_path) on public.user_identities to authenticated;