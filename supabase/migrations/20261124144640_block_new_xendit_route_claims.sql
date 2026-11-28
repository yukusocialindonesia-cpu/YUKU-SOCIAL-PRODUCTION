-- Prevent Xendit from being claimed for new bookings while preserving
-- already-locked legacy Xendit bookings and server-side historical settlement.
CREATE OR REPLACE FUNCTION public.claim_booking_payment_route(
  p_booking_id UUID,
  p_route TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_route IS NULL OR p_route NOT IN ('xendit', 'manual_qris', 'manual_bank_transfer') THEN
    RAISE EXCEPTION 'Jalur pembayaran tidak valid.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.customer_id <> v_actor THEN
    RAISE EXCEPTION 'Booking tidak ditemukan.';
  END IF;

  IF v_booking.status <> 'pending_payment'::public.booking_status_type THEN
    RAISE EXCEPTION 'Booking tidak lagi menunggu pembayaran.';
  END IF;

  IF v_booking.payment_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Batas waktu pembayaran telah kedaluwarsa.';
  END IF;

  -- Do not allow Xendit to be selected for a booking with no locked route.
  -- A booking already locked to Xendit may still complete its legacy flow.
  IF v_booking.payment_route IS NULL THEN
    IF p_route = 'xendit' THEN
      RAISE EXCEPTION 'Xendit tidak tersedia untuk checkout baru.';
    END IF;

    IF p_route = 'manual_qris' AND NOT EXISTS (
      SELECT 1 FROM public.qris_payment_settings
      WHERE id = TRUE AND is_active
    ) THEN
      RAISE EXCEPTION 'Pembayaran QRIS sedang tidak aktif.';
    END IF;

    IF p_route = 'manual_bank_transfer' AND NOT EXISTS (
      SELECT 1 FROM public.bank_transfer_settings
      WHERE id = TRUE AND is_active
    ) THEN
      RAISE EXCEPTION 'Transfer bank sedang tidak aktif.';
    END IF;

    UPDATE public.bookings
    SET payment_route = p_route, updated_at = NOW()
    WHERE id = p_booking_id;
    RETURN TRUE;
  END IF;

  IF v_booking.payment_route <> p_route THEN
    RAISE EXCEPTION 'Booking ini sudah mengunci jalur pembayaran % dan tidak dapat berpindah.',
      v_booking.payment_route;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_booking_payment_route(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_booking_payment_route(UUID, TEXT)
  TO authenticated;
