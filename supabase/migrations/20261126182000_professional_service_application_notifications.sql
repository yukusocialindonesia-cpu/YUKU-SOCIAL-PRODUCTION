-- Notify the applicant when their professional-service application changes,
-- and notify admins when a new application enters the review queue.
-- Uses the existing in-app notifications table; no parallel notification system.

create or replace function public.notify_professional_service_application_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
  v_status_label text;
begin
  begin
    if tg_op = 'INSERT' then
      -- Confirmation for the applicant.
      insert into public.notifications (user_id, title, message, type, metadata)
      values (
        new.applicant_id,
        'Pengajuan jasa profesional diterima',
        'Pengajuan Anda sudah masuk dan menunggu pemeriksaan tim YUKU.',
        'system_alert'::public.notification_type,
        jsonb_build_object(
          'route', '/dashboard-talent',
          'application_id', new.id,
          'status', new.status,
          'event', 'professional_service_application_submitted'
        )
      );

      -- Alert all active admins; the review page applies Talent permission checks.
      insert into public.notifications (user_id, title, message, type, metadata)
      select
        u.id,
        'Pengajuan jasa profesional baru',
        'Ada pengajuan jasa profesional baru yang menunggu pemeriksaan.',
        'system_alert'::public.notification_type,
        jsonb_build_object(
          'route', '/admin',
          'application_id', new.id,
          'applicant_id', new.applicant_id,
          'status', new.status,
          'event', 'professional_service_application_submitted'
        )
      from public.users u
      where u.role = 'admin'::public.user_role_type
        and u.account_status::text not in ('suspended', 'banned');

      return new;
    end if;

    if old.status is distinct from new.status then
      v_status_label := case new.status
        when 'under_review' then 'sedang diperiksa'
        when 'needs_revision' then 'memerlukan perbaikan'
        when 'approved' then 'disetujui'
        when 'rejected' then 'ditolak'
        else new.status
      end;

      v_title := case new.status
        when 'under_review' then 'Pengajuan sedang diperiksa'
        when 'needs_revision' then 'Pengajuan perlu diperbaiki'
        when 'approved' then 'Jasa profesional disetujui'
        when 'rejected' then 'Pengajuan jasa profesional ditolak'
        else 'Status pengajuan jasa profesional diperbarui'
      end;

      v_message := case new.status
        when 'under_review' then 'Tim YUKU sedang memeriksa pengajuan jasa profesional Anda.'
        when 'needs_revision' then 'Ada bagian pengajuan yang perlu Anda perbaiki. Buka riwayat pengajuan untuk membaca catatan Admin.'
        when 'approved' then 'Pengajuan Anda disetujui dan layanan dapat ditampilkan sesuai ketentuan YUKU.'
        when 'rejected' then 'Pengajuan Anda belum dapat disetujui. Buka riwayat pengajuan untuk membaca catatan Admin.'
        else 'Status pengajuan Anda berubah menjadi ' || v_status_label || '.'
      end;

      insert into public.notifications (user_id, title, message, type, metadata)
      values (
        new.applicant_id,
        v_title,
        v_message,
        'system_alert'::public.notification_type,
        jsonb_build_object(
          'route', '/dashboard-talent',
          'application_id', new.id,
          'status', new.status,
          'admin_note', new.admin_note,
          'event', 'professional_service_application_status_changed'
        )
      );
    end if;
  exception when others then
    -- A notification failure must never roll back an application submission/review.
    raise warning 'notify_professional_service_application_event failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notify_professional_service_application_event() from public, anon, authenticated;

drop trigger if exists trg_professional_service_application_notifications_insert
  on public.professional_service_applications;
create trigger trg_professional_service_application_notifications_insert
after insert on public.professional_service_applications
for each row execute function public.notify_professional_service_application_event();

drop trigger if exists trg_professional_service_application_notifications_status
  on public.professional_service_applications;
create trigger trg_professional_service_application_notifications_status
after update of status on public.professional_service_applications
for each row
when (old.status is distinct from new.status)
execute function public.notify_professional_service_application_event();

comment on function public.notify_professional_service_application_event() is
  'Creates in-app notifications for applicants and admins on professional service application submission/status changes. Notification errors do not block application writes.';
