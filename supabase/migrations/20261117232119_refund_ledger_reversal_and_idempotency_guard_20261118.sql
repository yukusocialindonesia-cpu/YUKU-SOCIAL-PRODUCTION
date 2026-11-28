CREATE UNIQUE INDEX IF NOT EXISTS refunds_provider_refund_id_unique
ON public.refunds (provider_refund_id)
WHERE provider_refund_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_process_refund(
  p_refund_id uuid,
  p_new_status public.refund_status_type,
  p_provider_refund_id text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_case public.customer_cancellation_cases%ROWTYPE;
  v_already_processed bigint := 0;
  v_full_refund boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin/Finance YUKU yang dapat memproses refund.';
  END IF;

  IF p_new_status <> 'processed'::public.refund_status_type THEN
    RAISE EXCEPTION 'Refund hanya dapat ditandai selesai setelah pengembalian dana benar-benar dilakukan.';
  END IF;

  IF NULLIF(trim(COALESCE(p_provider_refund_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Referensi refund dari bank/provider wajib diisi.';
  END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF NOT FOUND OR v_refund.status NOT IN (
    'requested'::public.refund_status_type,
    'approved'::public.refund_status_type
  ) THEN
    RAISE EXCEPTION 'Permintaan refund tidak ditemukan atau sudah diproses.';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_refund.payment_id
  FOR UPDATE;

  IF NOT FOUND OR v_payment.payment_status NOT IN (
    'settled_held'::public.payment_status_type,
    'refunded'::public.payment_status_type
  ) THEN
    RAISE EXCEPTION 'Pembayaran asal tidak berada dalam status yang dapat direfund.';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_refund.booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.id <> v_payment.booking_id THEN
    RAISE EXCEPTION 'Booking tidak cocok dengan pembayaran asal.';
  END IF;

  SELECT COALESCE(SUM(refund_amount), 0)::bigint
  INTO v_already_processed
  FROM public.refunds
  WHERE payment_id = v_refund.payment_id
    AND status = 'processed'::public.refund_status_type
    AND id <> p_refund_id;

  IF v_already_processed + v_refund.refund_amount > v_payment.amount THEN
    RAISE EXCEPTION 'Total refund melebihi jumlah pembayaran.';
  END IF;

  -- Partial refunds are only permitted for the automatic portion of a
  -- customer cancellation policy. Any retained amount requires the
  -- dedicated Admin case-resolution RPC.
  SELECT * INTO v_case
  FROM public.customer_cancellation_cases
  WHERE booking_id = v_booking.id
    AND payment_id = v_payment.id
  FOR UPDATE;

  IF FOUND THEN
    IF v_already_processed + v_refund.refund_amount > v_case.automatic_refund_amount THEN
      RAISE EXCEPTION 'Refund ini melebihi bagian otomatis sesuai kebijakan pembatalan. Dana tertahan harus diputuskan melalui kasus Admin.';
    END IF;
  ELSIF v_already_processed + v_refund.refund_amount < v_payment.amount THEN
    RAISE EXCEPTION 'Refund parsial di luar kebijakan pembatalan memerlukan proses kasus Admin khusus.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.refunds
    WHERE provider_refund_id = trim(p_provider_refund_id)
      AND id <> p_refund_id
  ) THEN
    RAISE EXCEPTION 'Referensi refund provider sudah pernah digunakan.';
  END IF;

  v_full_refund := (v_already_processed + v_refund.refund_amount = v_payment.amount);

  UPDATE public.refunds
  SET status = 'processed'::public.refund_status_type,
      provider_refund_id = trim(p_provider_refund_id),
      processed_by_admin_id = auth.uid(),
      processed_at = NOW()
  WHERE id = p_refund_id;

  IF v_full_refund THEN
    UPDATE public.payments
    SET payment_status = 'refunded'::public.payment_status_type,
        updated_at = NOW()
    WHERE id = v_refund.payment_id;

    UPDATE public.commission_records
    SET platform_commission_amount = 0,
        talent_gross_share = 0,
        referral_payout_reserved = 0,
        net_platform_revenue = 0
    WHERE booking_id = v_refund.booking_id;

    UPDATE public.referral_rewards
    SET status = 'cancelled_disputed'::public.referral_reward_status_type,
        status_before_dispute = NULL
    WHERE booking_id = v_refund.booking_id;

    -- Trigger performs an idempotent Talent earning reversal. Existing
    -- customer/talent cancellation statuses have already invoked it.
    IF v_booking.status NOT IN (
      'cancelled_by_customer'::public.booking_status_type,
      'cancelled_by_talent'::public.booking_status_type,
      'refunded'::public.booking_status_type
    ) THEN
      UPDATE public.bookings
      SET status = 'refunded'::public.booking_status_type,
          updated_at = NOW()
      WHERE id = v_booking.id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  )
  VALUES (
    auth.uid(), 'admin_process_refund', 'refunds', p_refund_id::text,
    jsonb_build_object(
      'status', v_refund.status,
      'refund_amount', v_refund.refund_amount,
      'payment_id', v_refund.payment_id
    ),
    jsonb_build_object(
      'status', p_new_status,
      'provider_refund_id', trim(p_provider_refund_id),
      'admin_notes', p_admin_notes,
      'payment_marked_refunded', v_full_refund,
      'booking_status_after_full_refund', CASE WHEN v_full_refund THEN
        CASE WHEN v_booking.status IN (
          'cancelled_by_customer'::public.booking_status_type,
          'cancelled_by_talent'::public.booking_status_type
        ) THEN v_booking.status::text ELSE 'refunded' END
        ELSE v_booking.status::text END
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_process_refund(uuid,public.refund_status_type,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_process_refund(uuid,public.refund_status_type,text,text) TO authenticated;
