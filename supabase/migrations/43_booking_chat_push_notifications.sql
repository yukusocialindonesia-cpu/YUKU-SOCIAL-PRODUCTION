-- Notify the other booking participant when a new booking chat message is inserted.
-- Uses the existing notification helper and existing notifications -> web-push trigger.
CREATE OR REPLACE FUNCTION public.notify_on_booking_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid;
  v_talent_id uuid;
  v_booking_code varchar;
  v_recipient_id uuid;
  v_route text;
BEGIN
  SELECT b.customer_id, b.talent_id, b.booking_code
    INTO v_customer_id, v_talent_id, v_booking_code
  FROM public.bookings AS b
  WHERE b.id = NEW.booking_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = v_customer_id THEN
    v_recipient_id := v_talent_id;
    v_route := '/dashboard-talent';
  ELSIF NEW.sender_id = v_talent_id THEN
    v_recipient_id := v_customer_id;
    v_route := '/riwayat-booking';
  ELSE
    RETURN NEW;
  END IF;

  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;


  PERFORM public.create_in_app_notification(
    v_recipient_id,
    'Pesan Chat Baru',
    'Anda menerima pesan baru pada booking ' || v_booking_code || '. Buka YUKU untuk membaca percakapan.',
    'booking_update'::public.notification_type,
    jsonb_build_object(
      'booking_id', NEW.booking_id,
      'booking_code', v_booking_code,
      'message_id', NEW.id,
      'route', v_route
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_booking_message_insert ON public.booking_messages;
CREATE TRIGGER trg_notify_booking_message_insert
AFTER INSERT ON public.booking_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_booking_message_insert();
