-- Private booking messages are readable only by the two booking participants.
-- Booking Admins must use the explicit report/moderation workflow, not read all chat bodies.
DROP POLICY IF EXISTS booking_messages_select_participants ON public.booking_messages;
CREATE POLICY booking_messages_select_participants
ON public.booking_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND b.status IN (
        'paid_held_in_escrow',
        'confirmed_by_talent',
        'in_progress',
        'completed',
        'disputed_hold'
      )
  )
);

-- Keep private message text out of both in-app notification previews and push payloads.
CREATE OR REPLACE FUNCTION public.notify_on_booking_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID;
  v_talent_id UUID;
  v_booking_code VARCHAR;
  v_recipient_id UUID;
  v_route TEXT;
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
$$;
COMMENT ON POLICY booking_messages_select_participants ON public.booking_messages IS
  'Only active booking participants can read private message bodies; Admin permissions do not grant blanket chat access.';
COMMENT ON FUNCTION public.notify_on_booking_message_insert() IS
  'Creates generic chat notifications; private message content is never copied into notification or push text.';
