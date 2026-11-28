-- 1. Pencairan: terapkan syarat kelayakan talent juga pada jalur insert langsung
CREATE OR REPLACE FUNCTION public.validate_payout_request_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_available_balance BIGINT;
BEGIN
  -- A. Paksa atribut awal
  NEW.payout_status := 'requested'::public.payout_status_type;
  NEW.processed_by_admin_id := NULL;
  NEW.payout_provider_ref := NULL;
  NEW.provider_confirmed_at := NULL;

  -- A2. Syarat kelayakan talent (sama dengan fungsi request_talent_payout)
  IF NOT (
    public.is_admin()
    OR session_user IN ('postgres', 'supabase_admin')
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.talent_profiles tp ON tp.id = u.id
      JOIN public.user_identities ui ON ui.id = u.id
      WHERE u.id = NEW.talent_id
        AND u.id = auth.uid()
        AND u.role = 'talent'::public.user_role_type
        AND u.account_status = 'active'::public.account_status_type
        AND u.is_verified_18 IS TRUE
        AND tp.is_approved IS TRUE
        AND ui.ktp_verification_status = 'verified'::public.ktp_status_type
    ) THEN
      RAISE EXCEPTION 'Hanya Talent aktif yang sudah lolos verifikasi dan persetujuan dapat mengajukan pencairan.';
    END IF;
  END IF;

  -- B. Validasi batas minimal pencairan Rp100.000
  IF NEW.amount < 100000 THEN
    RAISE EXCEPTION 'Batas minimal pencairan saldo adalah Rp100.000.';
  END IF;

  -- C. Concurrency Lock: Kunci profil talent dengan FOR UPDATE
  PERFORM 1 FROM public.talent_profiles WHERE id = NEW.talent_id FOR UPDATE;

  -- D. Hitung total saldo yang benar-benar tersedia
  SELECT COALESCE(SUM(net_earning - (allocated_payout_amount + paid_out_amount)), 0) INTO v_available_balance
  FROM (
    SELECT net_earning, allocated_payout_amount, paid_out_amount
    FROM public.talent_earnings
    WHERE talent_id = NEW.talent_id
      AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
      AND (net_earning - (allocated_payout_amount + paid_out_amount)) > 0
    FOR UPDATE
  ) sub;

  IF NEW.amount > v_available_balance THEN
    RAISE EXCEPTION 'Saldo tidak mencukupi untuk pencairan. Saldo tersedia: Rp%. Pencairan diminta: Rp%', v_available_balance, NEW.amount;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Laporan: batasi kolom yang boleh diisi pelapor
REVOKE INSERT ON public.reports_complaints FROM authenticated;
GRANT INSERT (reporter_id, reported_user_id, booking_id, category, description, evidence_urls)
  ON public.reports_complaints TO authenticated;

-- 3. Pembatalan customer: wajib ada kasus pembatalan (dibuat oleh request_customer_cancellation)
CREATE OR REPLACE FUNCTION public.guard_booking_status_actor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF session_user IN ('postgres', 'supabase_admin')
     OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
     OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled_by_customer'::public.booking_status_type THEN
    IF v_actor IS NULL OR v_actor <> OLD.customer_id THEN
      RAISE EXCEPTION 'Hanya Customer pemesan yang dapat membatalkan booking sebagai cancelled_by_customer.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.customer_cancellation_cases cc
      WHERE cc.booking_id = OLD.id
        AND cc.customer_id = OLD.customer_id
    ) THEN
      RAISE EXCEPTION 'Pembatalan Customer harus melalui permintaan pembatalan resmi terlebih dahulu.';
    END IF;

  ELSIF NEW.status = 'cancelled_by_talent'::public.booking_status_type THEN
    IF v_actor IS NULL OR v_actor <> OLD.talent_id THEN
      RAISE EXCEPTION 'Hanya Talent pemilik booking yang dapat membatalkan booking sebagai cancelled_by_talent.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.refunds rf
      WHERE rf.booking_id = OLD.id
        AND rf.customer_id = OLD.customer_id
        AND rf.refund_amount >= OLD.gross_amount
        AND rf.status = 'requested'::public.refund_status_type
    ) THEN
      RAISE EXCEPTION 'Pembatalan Talent harus membuat permintaan refund penuh terlebih dahulu.';
    END IF;

  ELSIF NEW.status IN (
    'confirmed_by_talent'::public.booking_status_type,
    'in_progress'::public.booking_status_type
  ) THEN
    IF v_actor IS NULL OR v_actor <> OLD.talent_id THEN
      RAISE EXCEPTION 'Hanya Talent pemilik booking yang dapat mengubah status sesi ini.';
    END IF;

  ELSIF NEW.status = 'completed'::public.booking_status_type THEN
    IF NEW.customer_completed_at IS NULL OR NEW.talent_completed_at IS NULL THEN
      RAISE EXCEPTION 'Booking hanya dapat selesai setelah Customer dan Talent sama-sama mengonfirmasi sesi.';
    END IF;

  ELSIF NEW.status = 'disputed_hold'::public.booking_status_type THEN
    IF v_actor IS NULL OR v_actor NOT IN (OLD.customer_id, OLD.talent_id) THEN
      RAISE EXCEPTION 'Hanya peserta booking atau Admin yang dapat menahan booking karena sengketa.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.reports_complaints rc
      WHERE rc.booking_id = OLD.id
        AND rc.status IN ('open'::public.report_status_type, 'investigating'::public.report_status_type)
    ) THEN
      RAISE EXCEPTION 'Booking hanya dapat ditahan jika ada laporan sengketa aktif.';
    END IF;

  ELSIF NEW.status IN (
    'paid_held_in_escrow'::public.booking_status_type,
    'refunded'::public.booking_status_type,
    'expired'::public.booking_status_type
  ) THEN
    RAISE EXCEPTION 'Perubahan status ini hanya boleh dilakukan backend pembayaran atau Admin.';
  END IF;

  RETURN NEW;
END;
$function$;