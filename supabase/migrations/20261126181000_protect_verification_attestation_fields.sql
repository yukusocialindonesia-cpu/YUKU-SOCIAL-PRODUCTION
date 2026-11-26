-- Applicants must never be able to forge reviewer verification metadata during resubmission.
create or replace function public.guard_professional_application_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'needs_revision'
     and auth.uid() = old.applicant_id then
    if new.id is distinct from old.id
       or new.applicant_id is distinct from old.applicant_id
       or new.subcategory_id is distinct from old.subcategory_id
       or new.created_at is distinct from old.created_at
       or new.verification_note is distinct from old.verification_note
       or new.verification_checked_by is distinct from old.verification_checked_by
       or new.verification_checked_at is distinct from old.verification_checked_at then
      raise exception 'Identitas, jenis layanan, dan metadata verifikasi admin tidak dapat diubah pemohon.'
        using errcode = '42501';
    end if;

    if new.status is distinct from 'pending'
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.admin_note is not null then
      raise exception 'Pengajuan revisi hanya boleh dikirim ulang ke status pending.'
        using errcode = '42501';
    end if;

    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.guard_professional_application_revision()
  from public, anon, authenticated;
