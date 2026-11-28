CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_actor character varying;
  v_by    uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    v_actor := 'system'; v_by := NULL;
  ELSIF public.is_admin() THEN
    v_actor := 'admin';  v_by := v_uid;
  ELSE
    v_actor := 'user';   v_by := v_uid;
  END IF;

  INSERT INTO public.booking_status_history
    (booking_id, previous_status, new_status, changed_by_user_id, notes, actor_type)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END,
    NEW.status::text,
    v_by,
    CASE WHEN TG_OP = 'INSERT' THEN 'Reservasi dibuat'
         ELSE NEW.cancellation_reason END,
    v_actor
  );

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_booking_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_booking_status_change ON public.bookings;
CREATE TRIGGER trg_log_booking_status_change
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();