-- Do not expose internal Admin moderation notes through user notifications.
-- admin_notes is an internal review field; only report status is user-facing.

CREATE OR REPLACE FUNCTION public.notify_on_report_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_in_app_notification(
    NEW.reporter_id,
    'Pembaruan Laporan Insiden Anda',
    'Status laporan Anda telah diperbarui menjadi: ' || NEW.status::text || '.',
    'system_alert'::public.notification_type,
    jsonb_build_object('report_id', NEW.id, 'booking_id', NEW.booking_id)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_on_report_status_change() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_on_report_status_change() IS
  'Notifies the report author about status changes without disclosing internal Admin moderation notes.';
