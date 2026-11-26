-- Prevent applicants from changing the identity or service type of an application
-- while resubmitting a request that was returned for revision.
-- Admin decisions through the SECURITY DEFINER review RPC remain unaffected.
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
       or new.created_at is distinct from old.created_at then
      raise exception 'Identitas pemohon dan jenis layanan tidak dapat diubah saat revisi. Buat pengajuan baru untuk jenis layanan lain.'
        using errcode = '42501';
    end if;

    if new.status is distinct from 'pending'
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.admin_note is not null then
      raise exception 'Pengajuan revisi hanya boleh dikirim ulang ke status pending.'
        using errcode = '42501';
    end if;

    -- The applicant may edit service details, pricing, delivery modes and
    -- replace their own evidence paths; the timestamp is server controlled.
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_professional_application_revision
  on public.professional_service_applications;

create trigger trg_guard_professional_application_revision
before update on public.professional_service_applications
for each row
execute function public.guard_professional_application_revision();

revoke all on function public.guard_professional_application_revision()
  from public, anon, authenticated;

comment on function public.guard_professional_application_revision() is
  'Locks applicant_id, subcategory_id and creation identity during applicant resubmission; allows only service detail corrections and the needs_revision to pending transition.';
