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
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check ownership before taking a row lock.
  PERFORM 1
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.talent_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan atau bukan milik Anda.';
  END IF;

  -- Booking is locked before validation. Payment is read without a row lock:
  -- admin_process_refund() locks payment before booking, so taking a payment
  -- lock here would create a lock-order inversion and possible deadlock.
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

  PERFORM 1
  FROM public.payments p
  WHERE p.booking_id = p_booking_id
    AND p.payment_status = 'settled_held'::public.payment_status_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pembayaran belum terkonfirmasi dalam escrow.';
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
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check ownership before taking a row lock.
  PERFORM 1
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.talent_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan atau bukan milik Anda.';
  END IF;

  -- Lock the booking first, matching the existing Talent/Customer booking
  -- transition RPCs. Do not lock payments here: refund processing uses the
  -- opposite payment -> booking lock order.
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

  PERFORM 1
  FROM public.payments p
  WHERE p.booking_id = p_booking_id
    AND p.payment_status = 'settled_held'::public.payment_status_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pembayaran tidak lagi berada dalam escrow.';
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

-- Remove direct mutation of booking workflow/system columns from the client role.
-- Customer, Talent, Admin and Super Admin must use their guarded RPCs.
-- SECURITY DEFINER RPCs owned by the database owner retain their internal UPDATE ability.
-- This prevents clients from changing status, injecting cancellation reasons, or
-- tampering with updated_at outside the approved business workflows.
REVOKE UPDATE (status, cancellation_reason, updated_at)
ON public.bookings FROM PUBLIC, anon, authenticated;
