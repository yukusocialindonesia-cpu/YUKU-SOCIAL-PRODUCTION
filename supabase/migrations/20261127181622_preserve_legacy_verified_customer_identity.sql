-- Preserve already-verified legacy Customer records without retroactively treating them
-- as having selfie evidence. Re-check evidence on new verification decisions or path changes.
create or replace function public.guard_ktp_verified_requires_valid_identity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_has_customer_profile boolean;
  v_must_validate boolean;
begin
  if new.ktp_verification_status <> 'verified'::public.ktp_status_type then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_must_validate := true;
  else
    v_must_validate :=
      old.ktp_verification_status is distinct from 'verified'::public.ktp_status_type
      or new.ktp_storage_path is distinct from old.ktp_storage_path
      or new.selfie_storage_path is distinct from old.selfie_storage_path;
  end if;

  -- Existing verified records are legacy approvals. Do not block unrelated profile
  -- maintenance merely because the historic flow never stored a selfie path.
  if not v_must_validate then
    return new;
  end if;

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

  return new;
end;
$function$;