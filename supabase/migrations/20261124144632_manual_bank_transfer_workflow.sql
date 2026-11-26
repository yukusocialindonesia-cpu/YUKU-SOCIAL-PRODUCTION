-- YUKU: manual bank transfer workflow. Additive migration; QRIS and legacy providers remain intact.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_route_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_route_check
  CHECK (payment_route IS NULL OR payment_route IN ('xendit', 'manual_qris', 'manual_bank_transfer'));

CREATE TABLE IF NOT EXISTS public.bank_transfer_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT 'Transfer tepat sesuai nominal booking, lalu unggah bukti pembayaran.',
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT is_active OR (length(trim(bank_name)) > 0 AND length(trim(account_number)) > 0 AND length(trim(account_holder)) > 0))
);
INSERT INTO public.bank_transfer_settings(id) VALUES(TRUE) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.bank_transfer_payment_instructions (
  booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  instructions TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_transfer_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  customer_id UUID NOT NULL REFERENCES public.users(id),
  proof_storage_path TEXT NOT NULL,
  claimed_amount BIGINT NOT NULL CHECK (claimed_amount > 0),
  transfer_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  admin_user_id UUID REFERENCES public.users(id),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status = 'pending_review' AND admin_user_id IS NULL AND reviewed_at IS NULL)
      OR (status <> 'pending_review' AND admin_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_transfer_one_pending_per_booking
  ON public.bank_transfer_submissions(booking_id) WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_bank_transfer_submissions_status_created
  ON public.bank_transfer_submissions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_transfer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL CHECK (action IN ('settings_changed','payment_approved','payment_rejected')),
  booking_id UUID REFERENCES public.bookings(id),
  submission_id UUID REFERENCES public.bank_transfer_submissions(id),
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_audit_created
  ON public.bank_transfer_audit_logs(created_at DESC);

ALTER TABLE public.bank_transfer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transfer_payment_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transfer_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transfer_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_transfer_settings, public.bank_transfer_payment_instructions,
  public.bank_transfer_submissions, public.bank_transfer_audit_logs FROM PUBLIC, anon, authenticated;

CREATE POLICY bank_transfer_settings_read_active_or_finance
  ON public.bank_transfer_settings FOR SELECT TO authenticated
  USING (is_active OR public.has_admin_permission('finance'));
CREATE POLICY bank_transfer_instructions_read_owner_or_finance
  ON public.bank_transfer_payment_instructions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid())
    OR public.has_admin_permission('finance')
  );
CREATE POLICY bank_transfer_submissions_read_owner_or_finance
  ON public.bank_transfer_submissions FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_admin_permission('finance'));
CREATE POLICY bank_transfer_audit_read_finance
  ON public.bank_transfer_audit_logs FOR SELECT TO authenticated
  USING (public.has_admin_permission('finance'));
GRANT SELECT ON public.bank_transfer_settings, public.bank_transfer_payment_instructions,
  public.bank_transfer_submissions, public.bank_transfer_audit_logs TO authenticated;

-- Selecting the bank transfer route locks the destination details to this booking.
CREATE OR REPLACE FUNCTION public.get_bank_transfer_instructions(p_booking_id UUID)
RETURNS TABLE(bank_name TEXT, account_number TEXT, account_holder TEXT, instructions TEXT, gross_amount BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_settings public.bank_transfer_settings%ROWTYPE;
  v_snapshot public.bank_transfer_payment_instructions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Booking tidak ditemukan.'; END IF;
  IF v_booking.status <> 'pending_payment'::public.booking_status_type
     OR v_booking.payment_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Booking tidak lagi dapat menerima pembayaran.';
  END IF;
  SELECT * INTO v_settings FROM public.bank_transfer_settings WHERE id = TRUE FOR SHARE;
  IF NOT FOUND OR NOT v_settings.is_active THEN
    -- Existing booking snapshots remain usable even after Admin deactivates or changes the current account.
    SELECT * INTO v_snapshot
      FROM public.bank_transfer_payment_instructions i WHERE i.booking_id = p_booking_id;
    IF FOUND THEN
      RETURN QUERY SELECT v_snapshot.bank_name, v_snapshot.account_number,
        v_snapshot.account_holder, v_snapshot.instructions, v_booking.gross_amount;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Transfer bank sedang tidak aktif.';
  END IF;
  PERFORM public.claim_booking_payment_route(p_booking_id, 'manual_bank_transfer');
  INSERT INTO public.bank_transfer_payment_instructions
    (booking_id, bank_name, account_number, account_holder, instructions)
  VALUES
    (p_booking_id, v_settings.bank_name, v_settings.account_number, v_settings.account_holder, v_settings.instructions)
  ON CONFLICT (booking_id) DO NOTHING;
  RETURN QUERY
    SELECT i.bank_name, i.account_number, i.account_holder, i.instructions, v_booking.gross_amount
    FROM public.bank_transfer_payment_instructions i WHERE i.booking_id = p_booking_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_bank_transfer_instructions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bank_transfer_instructions(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_bank_transfer_settings(
  p_is_active BOOLEAN, p_bank_name TEXT, p_account_number TEXT,
  p_account_holder TEXT, p_instructions TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_old JSONB; v_new JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('finance') THEN
    RAISE EXCEPTION 'Akses ditolak: izin Finance diperlukan.';
  END IF;
  IF COALESCE(p_is_active,FALSE) AND (
    NULLIF(trim(COALESCE(p_bank_name,'')),'') IS NULL
    OR NULLIF(trim(COALESCE(p_account_number,'')),'') IS NULL
    OR NULLIF(trim(COALESCE(p_account_holder,'')),'') IS NULL
  ) THEN RAISE EXCEPTION 'Nama bank, nomor rekening, dan nama pemilik wajib diisi.'; END IF;
  IF length(trim(COALESCE(p_bank_name,''))) > 100
     OR length(trim(COALESCE(p_account_number,''))) > 80
     OR length(trim(COALESCE(p_account_holder,''))) > 120
     OR length(trim(COALESCE(p_instructions,''))) > 500 THEN
    RAISE EXCEPTION 'Data rekening melebihi batas karakter yang diizinkan.';
  END IF;
  SELECT to_jsonb(s) INTO v_old FROM public.bank_transfer_settings s WHERE id = TRUE;
  INSERT INTO public.bank_transfer_settings(id,is_active,bank_name,account_number,account_holder,instructions,updated_by,updated_at)
  VALUES(TRUE,COALESCE(p_is_active,FALSE),trim(COALESCE(p_bank_name,'')),trim(COALESCE(p_account_number,'')),trim(COALESCE(p_account_holder,'')),COALESCE(NULLIF(trim(COALESCE(p_instructions,'')),''),'Transfer tepat sesuai nominal booking, lalu unggah bukti pembayaran.'),auth.uid(),NOW())
  ON CONFLICT(id) DO UPDATE SET is_active=EXCLUDED.is_active,bank_name=EXCLUDED.bank_name,
    account_number=EXCLUDED.account_number,account_holder=EXCLUDED.account_holder,
    instructions=EXCLUDED.instructions,updated_by=EXCLUDED.updated_by,updated_at=NOW();
  SELECT to_jsonb(s) INTO v_new FROM public.bank_transfer_settings s WHERE id = TRUE;
  INSERT INTO public.bank_transfer_audit_logs(actor_user_id,action,old_values,new_values)
  VALUES(auth.uid(),'settings_changed',v_old,v_new);
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_bank_transfer_settings(BOOLEAN,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_bank_transfer_settings(BOOLEAN,TEXT,TEXT,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_bank_transfer_payment_proof(
  p_booking_id UUID, p_proof_storage_path TEXT, p_claimed_amount BIGINT,
  p_transfer_reference TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_submission_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_claimed_amount IS NULL OR p_claimed_amount <= 0 THEN RAISE EXCEPTION 'Nominal pembayaran tidak valid.'; END IF;
  IF length(COALESCE(p_transfer_reference,'')) > 100 THEN RAISE EXCEPTION 'Referensi transaksi maksimal 100 karakter.'; END IF;
  IF p_proof_storage_path IS NULL OR p_proof_storage_path !~ ('^' || p_booking_id::text || '/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'Lokasi bukti pembayaran tidak valid.';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Booking tidak ditemukan.'; END IF;
  IF v_booking.status <> 'pending_payment' OR v_booking.payment_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Booking tidak lagi menunggu pembayaran.';
  END IF;
  IF v_booking.payment_route IS DISTINCT FROM 'manual_bank_transfer' THEN
    RAISE EXCEPTION 'Booking ini tidak terkunci pada metode transfer bank.';
  END IF;
  IF p_claimed_amount <> v_booking.gross_amount THEN RAISE EXCEPTION 'Nominal harus sama persis dengan total booking.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bank_transfer_payment_instructions WHERE booking_id=p_booking_id) THEN
    RAISE EXCEPTION 'Instruksi rekening belum tersimpan untuk booking ini.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='bank-transfer-payment-proofs' AND name=p_proof_storage_path) THEN
    RAISE EXCEPTION 'File bukti transfer tidak ditemukan di penyimpanan.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bank_transfer_submissions WHERE booking_id=p_booking_id AND status='pending_review') THEN
    RAISE EXCEPTION 'Bukti pembayaran masih menunggu pemeriksaan Admin.';
  END IF;
  INSERT INTO public.bank_transfer_submissions(booking_id,customer_id,proof_storage_path,claimed_amount,transfer_reference)
  VALUES(p_booking_id,auth.uid(),p_proof_storage_path,p_claimed_amount,NULLIF(trim(COALESCE(p_transfer_reference,'')),''))
  RETURNING id INTO v_submission_id;
  UPDATE public.bookings SET payment_expires_at=GREATEST(payment_expires_at,NOW()+INTERVAL '24 hours'),updated_at=NOW()
  WHERE id=p_booking_id;
  RETURN v_submission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_bank_transfer_payment_proof(UUID,TEXT,BIGINT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bank_transfer_payment_proof(UUID,TEXT,BIGINT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_bank_transfer_payment(
  p_submission_id UUID, p_approve BOOLEAN, p_admin_notes TEXT,
  p_transfer_reference TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_submission public.bank_transfer_submissions%ROWTYPE;
  v_booking public.bookings%ROWTYPE; v_payment public.payments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('finance') THEN
    RAISE EXCEPTION 'Akses ditolak: izin Finance diperlukan.';
  END IF;
  IF NULLIF(trim(COALESCE(p_admin_notes,'')),'') IS NULL THEN RAISE EXCEPTION 'Catatan pemeriksaan wajib diisi.'; END IF;
  IF length(COALESCE(p_admin_notes,'')) > 500 OR length(COALESCE(p_transfer_reference,'')) > 100 THEN
    RAISE EXCEPTION 'Catatan maksimal 500 karakter dan referensi maksimal 100 karakter.';
  END IF;
  SELECT * INTO v_submission FROM public.bank_transfer_submissions WHERE id=p_submission_id FOR UPDATE;
  IF NOT FOUND OR v_submission.status <> 'pending_review' THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan atau sudah diproses.'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=v_submission.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking tidak ditemukan.'; END IF;
  IF p_approve THEN
    IF v_booking.customer_id IS DISTINCT FROM v_submission.customer_id THEN
      RAISE EXCEPTION 'Pemilik pengajuan tidak cocok dengan pemilik booking.';
    END IF;
    IF v_submission.claimed_amount IS DISTINCT FROM v_booking.gross_amount THEN
      RAISE EXCEPTION 'Nominal pada pengajuan tidak cocok dengan total booking.';
    END IF;
    IF v_booking.status <> 'pending_payment' THEN RAISE EXCEPTION 'Booking tidak lagi menunggu pembayaran.'; END IF;
    IF v_booking.payment_expires_at <= NOW() THEN RAISE EXCEPTION 'Booking telah kedaluwarsa; pembayaran tidak boleh disahkan.'; END IF;
    IF v_booking.payment_route IS DISTINCT FROM 'manual_bank_transfer' THEN RAISE EXCEPTION 'Booking tidak terkunci pada transfer bank.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.bank_transfer_payment_instructions WHERE booking_id=v_booking.id) THEN
      RAISE EXCEPTION 'Snapshot rekening untuk booking ini tidak ditemukan.';
    END IF;
    IF NULLIF(trim(COALESCE(p_transfer_reference,'')),'') IS NULL THEN RAISE EXCEPTION 'Referensi transaksi bank wajib dicatat.'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.provider_charge_id = left(trim(p_transfer_reference),100)
    ) THEN
      RAISE EXCEPTION 'Referensi transaksi ini sudah digunakan pada pembayaran lain.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='bank-transfer-payment-proofs' AND name=v_submission.proof_storage_path) THEN
      RAISE EXCEPTION 'File bukti transfer sudah tidak tersedia; minta Customer mengirim ulang.';
    END IF;
    SELECT * INTO v_payment FROM public.payments WHERE booking_id=v_booking.id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.payments(booking_id,provider,provider_charge_id,payment_method,amount,payment_status,paid_at)
      VALUES(v_booking.id,'manual_bank_transfer',left(trim(p_transfer_reference),100),'bank_transfer',v_booking.gross_amount,'pending',NULL)
      RETURNING * INTO v_payment;
    END IF;
    IF v_payment.payment_status NOT IN ('pending','failed') THEN RAISE EXCEPTION 'Status pembayaran tidak dapat disahkan.'; END IF;
    UPDATE public.payments SET provider='manual_bank_transfer',provider_charge_id=left(trim(p_transfer_reference),100),
      payment_method='bank_transfer',amount=v_booking.gross_amount,payment_status='settled_held',
      paid_at=NOW(),updated_at=NOW() WHERE id=v_payment.id;
    UPDATE public.bookings SET status='paid_held_in_escrow',updated_at=NOW() WHERE id=v_booking.id;
    UPDATE public.bank_transfer_submissions SET status='approved',admin_user_id=auth.uid(),
      admin_notes=trim(p_admin_notes),reviewed_at=NOW() WHERE id=p_submission_id;
    INSERT INTO public.bank_transfer_audit_logs(actor_user_id,action,booking_id,submission_id,new_values,reason)
    VALUES(auth.uid(),'payment_approved',v_booking.id,p_submission_id,
      jsonb_build_object('amount',v_booking.gross_amount,'transfer_reference',trim(p_transfer_reference)),trim(p_admin_notes));
  ELSE
    UPDATE public.bank_transfer_submissions SET status='rejected',admin_user_id=auth.uid(),
      admin_notes=trim(p_admin_notes),reviewed_at=NOW() WHERE id=p_submission_id;
    INSERT INTO public.bank_transfer_audit_logs(actor_user_id,action,booking_id,submission_id,reason)
    VALUES(auth.uid(),'payment_rejected',v_booking.id,p_submission_id,trim(p_admin_notes));
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_bank_transfer_payment(UUID,BOOLEAN,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_bank_transfer_payment(UUID,BOOLEAN,TEXT,TEXT) TO authenticated;

-- Route lock now accepts the new manual bank-transfer route without allowing route switching.
CREATE OR REPLACE FUNCTION public.claim_booking_payment_route(p_booking_id UUID,p_route TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_route IS NULL OR p_route NOT IN ('xendit','manual_qris','manual_bank_transfer') THEN RAISE EXCEPTION 'Jalur pembayaran tidak valid.'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.customer_id <> v_actor THEN RAISE EXCEPTION 'Booking tidak ditemukan.'; END IF;
  IF v_booking.status <> 'pending_payment'::public.booking_status_type THEN RAISE EXCEPTION 'Booking tidak lagi menunggu pembayaran.'; END IF;
  IF v_booking.payment_expires_at <= NOW() THEN RAISE EXCEPTION 'Batas waktu pembayaran telah kedaluwarsa.'; END IF;
  IF v_booking.payment_route IS NULL THEN
    IF p_route = 'manual_qris' AND NOT EXISTS (
      SELECT 1 FROM public.qris_payment_settings WHERE id = TRUE AND is_active
    ) THEN RAISE EXCEPTION 'Pembayaran QRIS sedang tidak aktif.'; END IF;
    IF p_route = 'manual_bank_transfer' AND NOT EXISTS (
      SELECT 1 FROM public.bank_transfer_settings WHERE id = TRUE AND is_active
    ) THEN RAISE EXCEPTION 'Transfer bank sedang tidak aktif.'; END IF;
    UPDATE public.bookings SET payment_route=p_route,updated_at=NOW() WHERE id=p_booking_id;
    RETURN TRUE;
  END IF;
  IF v_booking.payment_route <> p_route THEN
    RAISE EXCEPTION 'Booking ini sudah mengunci jalur pembayaran % dan tidak dapat berpindah.',v_booking.payment_route;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_booking_payment_route(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_booking_payment_route(UUID,TEXT) TO authenticated;

-- Extend server-side settlement allow-list; legacy Xendit and QRIS behavior remains unchanged.
CREATE OR REPLACE FUNCTION public.settle_booking_payment(
  p_booking_id UUID,
  p_provider public.payment_provider_type DEFAULT 'xendit',
  p_provider_charge_id TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'qris',
  p_webhook_payload JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_route TEXT := p_provider::TEXT;
BEGIN
  IF session_user NOT IN ('postgres','supabase_admin')
     AND COALESCE(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Akses Ditolak: settlement hanya boleh dipanggil dari server.';
  END IF;
  IF p_provider NOT IN ('xendit'::public.payment_provider_type,'manual_qris'::public.payment_provider_type,'manual_bank_transfer'::public.payment_provider_type) THEN
    RAISE EXCEPTION 'Provider pembayaran tidak diizinkan untuk settlement.';
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking tidak ditemukan.'; END IF;
  IF v_booking.status <> 'pending_payment'::public.booking_status_type THEN
    IF v_booking.status IN ('paid_held_in_escrow'::public.booking_status_type,'confirmed_by_talent'::public.booking_status_type,'in_progress'::public.booking_status_type,'completed'::public.booking_status_type) THEN RETURN TRUE; END IF;
    RAISE EXCEPTION 'Booking sudah berstatus % dan tidak dapat dibayar.',v_booking.status;
  END IF;
  IF v_booking.payment_expires_at <= NOW() THEN
    UPDATE public.bookings SET status='expired'::public.booking_status_type,cancellation_reason='Batas waktu pembayaran telah habis',updated_at=NOW() WHERE id=p_booking_id;
    RAISE EXCEPTION 'Batas waktu pembayaran telah kedaluwarsa.';
  END IF;
  IF v_booking.payment_route IS NULL THEN
    UPDATE public.bookings SET payment_route=v_route,updated_at=NOW() WHERE id=p_booking_id;
  ELSIF v_booking.payment_route <> v_route THEN
    RAISE EXCEPTION 'Pembayaran ditolak: booking terkunci pada jalur %.',v_booking.payment_route;
  END IF;
  INSERT INTO public.payments(booking_id,provider,provider_charge_id,payment_method,amount,payment_status,paid_at,webhook_payload_history)
  VALUES(v_booking.id,p_provider,p_provider_charge_id,COALESCE(NULLIF(TRIM(p_payment_method),''),'qris'),v_booking.gross_amount,'settled_held'::public.payment_status_type,NOW(),ARRAY[COALESCE(p_webhook_payload,'{}'::jsonb)])
  ON CONFLICT(booking_id) DO UPDATE SET provider=EXCLUDED.provider,
    provider_charge_id=COALESCE(EXCLUDED.provider_charge_id,public.payments.provider_charge_id),
    payment_method=EXCLUDED.payment_method,payment_status='settled_held'::public.payment_status_type,
    paid_at=COALESCE(public.payments.paid_at,NOW()),
    webhook_payload_history=array_append(public.payments.webhook_payload_history,COALESCE(p_webhook_payload,'{}'::jsonb)),updated_at=NOW();
  UPDATE public.bookings SET status='paid_held_in_escrow'::public.booking_status_type,updated_at=NOW() WHERE id=v_booking.id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_booking_payment(UUID,public.payment_provider_type,TEXT,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_booking_payment(UUID,public.payment_provider_type,TEXT,TEXT,JSONB) TO service_role;

-- Proofs remain private. Upload is limited to the owning Customer's pending booking.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('bank-transfer-payment-proofs','bank-transfer-payment-proofs',FALSE,5242880,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=FALSE,file_size_limit=5242880,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf'];
CREATE POLICY bank_transfer_proof_upload_own_booking ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='bank-transfer-payment-proofs'
    AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id::text=(storage.foldername(name))[1]
      AND b.customer_id=auth.uid() AND b.status='pending_payment'::public.booking_status_type
      AND b.payment_route='manual_bank_transfer')
    AND NOT EXISTS (
      SELECT 1 FROM public.bank_transfer_submissions s
      WHERE s.proof_storage_path=name AND s.status='pending_review'
    )
  );
CREATE POLICY bank_transfer_proof_read_owner_or_finance ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='bank-transfer-payment-proofs'
    AND (public.has_admin_permission('finance')
      OR EXISTS(SELECT 1 FROM public.bank_transfer_submissions s WHERE s.proof_storage_path=name AND s.customer_id=auth.uid()))
  );


-- Tighten existing QRIS administration to the same Finance permission as bank transfer.
DROP POLICY IF EXISTS qris_settings_admin_update ON public.qris_payment_settings;
DROP POLICY IF EXISTS qris_settings_admin_insert ON public.qris_payment_settings;
DROP POLICY IF EXISTS qris_submissions_read_owner_or_admin ON public.qris_payment_submissions;
DROP POLICY IF EXISTS qris_audit_read_admin ON public.qris_payment_audit_logs;
CREATE POLICY qris_submissions_read_owner_or_finance ON public.qris_payment_submissions
  FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.has_admin_permission('finance'));
CREATE POLICY qris_audit_read_finance ON public.qris_payment_audit_logs
  FOR SELECT TO authenticated USING (public.has_admin_permission('finance'));
REVOKE INSERT, UPDATE ON public.qris_payment_settings FROM authenticated;

DROP POLICY IF EXISTS qris_display_admin_upload ON storage.objects;
DROP POLICY IF EXISTS qris_display_admin_update ON storage.objects;
CREATE POLICY qris_display_finance_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'qris-payment-display' AND public.has_admin_permission('finance'));
CREATE POLICY qris_display_finance_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'qris-payment-display' AND public.has_admin_permission('finance'))
  WITH CHECK (bucket_id = 'qris-payment-display' AND public.has_admin_permission('finance'));

-- The legacy QRIS RPC bodies are retained behind Finance-checked wrappers.
-- Remove inherited PUBLIC execution as well; Finance-only wrapper is the supported entry point.
REVOKE ALL ON FUNCTION public.admin_update_qris_settings(BOOLEAN,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_update_qris_settings_finance(
  p_is_active BOOLEAN, p_image_path TEXT, p_merchant_name TEXT DEFAULT NULL,
  p_merchant_identifier TEXT DEFAULT NULL, p_instructions TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('finance') THEN
    RAISE EXCEPTION 'Akses ditolak: izin Finance diperlukan.';
  END IF;
  RETURN public.admin_update_qris_settings(p_is_active,p_image_path,p_merchant_name,p_merchant_identifier,p_instructions);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_qris_settings_finance(BOOLEAN,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_qris_settings_finance(BOOLEAN,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- Remove inherited PUBLIC execution as well; Finance-only wrapper is the supported entry point.
REVOKE ALL ON FUNCTION public.admin_review_qris_payment(UUID,BOOLEAN,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_review_qris_payment_finance(
  p_submission_id UUID, p_approve BOOLEAN, p_admin_notes TEXT,
  p_transfer_reference TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('finance') THEN
    RAISE EXCEPTION 'Akses ditolak: izin Finance diperlukan.';
  END IF;
  RETURN public.admin_review_qris_payment(p_submission_id,p_approve,p_admin_notes,p_transfer_reference);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_qris_payment_finance(UUID,BOOLEAN,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_qris_payment_finance(UUID,BOOLEAN,TEXT,TEXT) TO authenticated;

DROP POLICY IF EXISTS qris_settings_read_active_or_admin ON public.qris_payment_settings;
CREATE POLICY qris_settings_read_active_or_finance ON public.qris_payment_settings
  FOR SELECT TO authenticated USING (is_active OR public.has_admin_permission('finance'));
DROP POLICY IF EXISTS qris_proof_read_owner_or_admin ON storage.objects;
CREATE POLICY qris_proof_read_owner_or_finance ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'qris-payment-proofs'
    AND (
      public.has_admin_permission('finance')
      OR EXISTS (SELECT 1 FROM public.qris_payment_submissions s
        WHERE s.proof_storage_path = name AND s.customer_id = auth.uid())
    )
  );

CREATE POLICY bank_transfer_proof_delete_own_booking ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='bank-transfer-payment-proofs'
    AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id::text=(storage.foldername(name))[1]
      AND b.customer_id=auth.uid() AND b.status='pending_payment'::public.booking_status_type
      AND b.payment_route='manual_bank_transfer')
  );

CREATE OR REPLACE FUNCTION public.get_bank_transfer_booking_statuses(p_booking_ids UUID[])
RETURNS TABLE(id UUID, status public.booking_status_type)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('finance') THEN
    RAISE EXCEPTION 'Akses ditolak: izin Finance diperlukan.';
  END IF;
  RETURN QUERY SELECT b.id, b.status FROM public.bookings b WHERE b.id = ANY(p_booking_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.get_bank_transfer_booking_statuses(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bank_transfer_booking_statuses(UUID[]) TO authenticated;

