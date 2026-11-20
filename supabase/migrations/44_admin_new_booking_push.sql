-- Notify the YUKU admin when a new booking is created.
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.create_in_app_notification(
    '8921a6a0-39f1-4d53-94ec-e4459a0936c3'::uuid,
    'Booking Baru YUKU',
    'Ada booking baru dengan kode ' || COALESCE(NEW.booking_code, NEW.id::text) || '. Silakan periksa dashboard Admin.',
    'booking_update'::public.notification_type,
    jsonb_build_object(
      'booking_id', NEW.id,
      'booking_code', NEW.booking_code,
      'route', '/admin/bookings'
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_admin_on_new_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admin_on_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_admin_on_new_booking
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_new_booking();