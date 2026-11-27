-- Retire Xendit from all new booking payment-route claims.
-- Historical payment_provider enum values and old payment rows remain intact.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings WHERE payment_route = 'xendit') THEN
    RAISE EXCEPTION 'Cannot retire Xendit route while legacy Xendit bookings still exist; reconcile them first.';
  END IF;
END;
$$;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_route_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_route_check
  CHECK (payment_route IS NULL OR payment_route IN ('manual_qris', 'manual_bank_transfer'));

CREATE OR REPLACE FUNCTION public.claim_booking_payment_route(
  p_booking_id UUID,
  p_route TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_route IS NULL OR p_route NOT IN ('manual_qris', 'manual_bank_transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak tersedia.';
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

  IF v_booking.payment_route IS NULL THEN
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
    RAISE EXCEPTION 'Booking ini sudah mengunci metode pembayaran % dan tidak dapat berpindah.',
      v_booking.payment_route;
  END IF;

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_booking_payment_route(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_booking_payment_route(UUID, TEXT) TO authenticated;


-- Remove Xendit as a server-side settlement provider as well.
-- The default is now manual QRIS; callers must explicitly pass bank transfer.
CREATE OR REPLACE FUNCTION public.settle_booking_payment(
  p_booking_id UUID,
  p_provider public.payment_provider_type DEFAULT 'manual_qris',
  p_provider_charge_id TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'qris',
  p_webhook_payload JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_route TEXT := p_provider::TEXT;
BEGIN
  IF session_user NOT IN ('postgres','supabase_admin')
     AND COALESCE(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Akses Ditolak: settlement hanya boleh dipanggil dari server.';
  END IF;

  IF p_provider NOT IN (
    'manual_qris'::public.payment_provider_type,
    'manual_bank_transfer'::public.payment_provider_type
  ) THEN
    RAISE EXCEPTION 'Provider pembayaran tidak lagi didukung.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan.';
  END IF;

  IF v_booking.status <> 'pending_payment'::public.booking_status_type THEN
    IF v_booking.status IN (
      'paid_held_in_escrow'::public.booking_status_type,
      'confirmed_by_talent'::public.booking_status_type,
      'in_progress'::public.booking_status_type,
      'completed'::public.booking_status_type
    ) THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'Booking sudah berstatus % dan tidak dapat dibayar.', v_booking.status;
  END IF;

  IF v_booking.payment_expires_at <= NOW() THEN
    UPDATE public.bookings
    SET status = 'expired'::public.booking_status_type,
        cancellation_reason = 'Batas waktu pembayaran telah habis',
        updated_at = NOW()
    WHERE id = p_booking_id;
    RAISE EXCEPTION 'Batas waktu pembayaran telah kedaluwarsa.';
  END IF;

  IF v_booking.payment_route IS NULL THEN
    IF p_provider = 'manual_qris'::public.payment_provider_type
       AND NOT EXISTS (
         SELECT 1 FROM public.qris_payment_settings
         WHERE id = TRUE AND is_active
       ) THEN
      RAISE EXCEPTION 'Pembayaran QRIS sedang tidak aktif.';
    END IF;

    IF p_provider = 'manual_bank_transfer'::public.payment_provider_type
       AND NOT EXISTS (
         SELECT 1 FROM public.bank_transfer_settings
         WHERE id = TRUE AND is_active
       ) THEN
      RAISE EXCEPTION 'Transfer bank sedang tidak aktif.';
    END IF;

    UPDATE public.bookings
    SET payment_route = v_route, updated_at = NOW()
    WHERE id = p_booking_id;
  ELSIF v_booking.payment_route <> v_route THEN
    RAISE EXCEPTION 'Pembayaran ditolak: booking terkunci pada metode %.', v_booking.payment_route;
  END IF;

  INSERT INTO public.payments(
    booking_id, provider, provider_charge_id, payment_method,
    amount, payment_status, paid_at, webhook_payload_history
  )
  VALUES (
    v_booking.id, p_provider, p_provider_charge_id,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'qris'),
    v_booking.gross_amount, 'settled_held'::public.payment_status_type,
    NOW(), ARRAY[COALESCE(p_webhook_payload, '{}'::jsonb)]
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_charge_id = COALESCE(EXCLUDED.provider_charge_id, public.payments.provider_charge_id),
    payment_method = EXCLUDED.payment_method,
    payment_status = 'settled_held'::public.payment_status_type,
    paid_at = COALESCE(public.payments.paid_at, NOW()),
    webhook_payload_history = array_append(
      public.payments.webhook_payload_history,
      COALESCE(p_webhook_payload, '{}'::jsonb)
    ),
    updated_at = NOW();

  UPDATE public.bookings
  SET status = 'paid_held_in_escrow'::public.booking_status_type,
      updated_at = NOW()
  WHERE id = v_booking.id;

  RETURN TRUE;
END;
$function$;
