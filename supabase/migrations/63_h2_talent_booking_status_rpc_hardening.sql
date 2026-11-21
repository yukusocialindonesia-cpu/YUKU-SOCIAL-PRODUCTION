-- H2 hardening: move Talent booking status transitions into guarded RPCs.
-- Production migration: review this SQL and all regression paths before applying.
-- No staging database is assumed or required for this repository change.

CREATE OR REPLACE FUNCTION public.request_talent_confirmation(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_payment_found boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Pre-check ownership without locking, so a caller cannot lock another
  -- user's payment row merely by guessing a booking UUID.
  PERFORM 1
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.talent_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan atau bukan milik Anda.';
  END IF;

  -- Lock order: payment, then booking. This matches admin_process_refund().
  PERFORM 1
  FROM public.payments p
  WHERE p.booking_id = p_booking_id
    AND p.payment_status = 'settled_held'::public.payment_status_type
  FOR UPDATE;

  v_payment_found := FOUND;
  IF NOT v_payment_found THEN
    RAISE EXCEPTION 'Pembayaran belum terkonfirmasi dalam escrow.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.talent_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Booking tidak ditemukan atau bukan milik Anda.';
  END IF;

  IF v_booking.status <> 'paid_held_in_escrow'::public.booking_status_type THEN
    RAISE EXCEPTION 'Status booking tidak dapat dikonfirmasi.';
  END IF;

  UPDATE public.bookings
  SET status = 'confirmed_by_talent'::public.booking_status_type,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'confirmed_by_talent'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_talent_start_session(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_payment_found boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Ownership pre-check before taking any row lock.
  PERFORM 1
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.talent_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan atau bukan milik Anda.';
  END IF;

  -- Keep the payment -> booking lock order consistent with refund processing.
  PERFORM 1
  FROM public.payments p
  WHERE p.booking_id = p_booking_id
    AND p.payment_status = 'settled_held'::public.payment_status_type
  FOR UPDATE;

  v_payment_found := FOUND;
  IF NOT v_payment_found THEN
    RAISE EXCEPTION 'Pembayaran tidak lagi berada dalam escrow.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.talent_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Booking tidak ditemukan atau bukan milik Anda.';
  END IF;

  IF v_booking.status <> 'confirmed_by_talent'::public.booking_status_type THEN
    RAISE EXCEPTION 'Booking belum dapat dimulai.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reports_complaints rc
    WHERE rc.booking_id = p_booking_id
      AND rc.status IN ('open'::public.report_status_type, 'investigating'::public.report_status_type)
  ) THEN
    RAISE EXCEPTION 'Booking ditahan karena laporan aktif.';
  END IF;

  UPDATE public.bookings
  SET status = 'in_progress'::public.booking_status_type,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'in_progress'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_talent_confirmation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_talent_start_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_talent_confirmation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_talent_start_session(uuid) TO authenticated;

-- Remove direct status transitions from the client role.
-- SECURITY DEFINER RPCs owned by the database owner retain their internal UPDATE ability.
REVOKE UPDATE (status) ON public.bookings FROM authenticated;
