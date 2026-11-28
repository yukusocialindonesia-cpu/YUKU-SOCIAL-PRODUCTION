-- Enforce scoped Admin permissions inside database trigger guards.
-- Super Admin keeps full administrative override; scoped Admins must pass
-- the permission for the module their operation belongs to.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR private.is_super_admin(auth.uid());
$function$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_booking_status_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Booking, Finance, and Support actions can legitimately resolve
  -- operational booking states through their individually guarded RPCs.
  IF public.has_admin_permission('booking')
     OR public.has_admin_permission('finance')
     OR public.has_admin_permission('support') THEN
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

CREATE OR REPLACE FUNCTION public.validate_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF public.has_admin_permission('booking')
     OR public.has_admin_permission('finance')
     OR public.has_admin_permission('support')
     OR session_user IN ('postgres', 'supabase_admin')
     OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.hourly_rate_snapshot IS DISTINCT FROM OLD.hourly_rate_snapshot
     OR NEW.gross_amount IS DISTINCT FROM OLD.gross_amount
     OR NEW.platform_fee_amount IS DISTINCT FROM OLD.platform_fee_amount
     OR NEW.talent_gross_share IS DISTINCT FROM OLD.talent_gross_share
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.talent_id IS DISTINCT FROM OLD.talent_id
     OR NEW.activity_category_id IS DISTINCT FROM OLD.activity_category_id THEN
    RAISE EXCEPTION 'Akses Ditolak: Rincian finansial dan relasi booking tidak dapat diubah.';
  END IF;

  IF OLD.status IN (
    'paid_held_in_escrow'::public.booking_status_type,
    'confirmed_by_talent'::public.booking_status_type,
    'in_progress'::public.booking_status_type,
    'completed'::public.booking_status_type
  ) THEN
    IF NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_time IS DISTINCT FROM OLD.end_time
       OR NEW.duration_hours IS DISTINCT FROM OLD.duration_hours
       OR NEW.meeting_location_name IS DISTINCT FROM OLD.meeting_location_name
       OR NEW.meeting_location_address IS DISTINCT FROM OLD.meeting_location_address THEN
      RAISE EXCEPTION 'Akses Ditolak: Jadwal dan lokasi booking yang telah dibayar tidak dapat diubah sepihak.';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending_payment'::public.booking_status_type
       AND NEW.status NOT IN (
         'paid_held_in_escrow'::public.booking_status_type,
         'cancelled_by_customer'::public.booking_status_type,
         'expired'::public.booking_status_type
       ) THEN
      RAISE EXCEPTION 'Transisi status tidak valid dari % ke %', OLD.status, NEW.status;
    ELSIF OLD.status = 'paid_held_in_escrow'::public.booking_status_type
       AND NEW.status NOT IN (
         'confirmed_by_talent'::public.booking_status_type,
         'cancelled_by_talent'::public.booking_status_type,
         'cancelled_by_customer'::public.booking_status_type,
         'disputed_hold'::public.booking_status_type,
         'refunded'::public.booking_status_type
       ) THEN
      RAISE EXCEPTION 'Transisi status tidak valid dari % ke %', OLD.status, NEW.status;
    ELSIF OLD.status = 'confirmed_by_talent'::public.booking_status_type
       AND NEW.status NOT IN (
         'in_progress'::public.booking_status_type,
         'cancelled_by_talent'::public.booking_status_type,
         'cancelled_by_customer'::public.booking_status_type,
         'disputed_hold'::public.booking_status_type,
         'refunded'::public.booking_status_type
       ) THEN
      RAISE EXCEPTION 'Transisi status tidak valid dari % ke %', OLD.status, NEW.status;
    ELSIF OLD.status = 'in_progress'::public.booking_status_type
       AND NEW.status NOT IN (
         'completed'::public.booking_status_type,
         'disputed_hold'::public.booking_status_type
       ) THEN
      RAISE EXCEPTION 'Transisi status tidak valid dari % ke %', OLD.status, NEW.status;
    ELSIF OLD.status = 'completed'::public.booking_status_type
       AND NEW.status NOT IN ('disputed_hold'::public.booking_status_type) THEN
      RAISE EXCEPTION 'Transisi status tidak valid dari % ke %', OLD.status, NEW.status;
    ELSIF OLD.status IN (
      'refunded'::public.booking_status_type,
      'cancelled_by_customer'::public.booking_status_type,
      'cancelled_by_talent'::public.booking_status_type,
      'expired'::public.booking_status_type
    ) THEN
      RAISE EXCEPTION 'Booking yang sudah selesai/batal tidak dapat diubah statusnya.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_payout_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_alloc_rec RECORD;
BEGIN
  IF NOT public.has_admin_permission('finance')
     AND session_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    IF NEW.payout_status IS DISTINCT FROM OLD.payout_status
       OR NEW.payout_provider_ref IS DISTINCT FROM OLD.payout_provider_ref
       OR NEW.processed_by_admin_id IS DISTINCT FROM OLD.processed_by_admin_id THEN
      RAISE EXCEPTION 'Akses Ditolak: Status pencairan hanya dapat diproses oleh Admin Keuangan / Provider Callback.';
    END IF;
  END IF;

  IF NEW.payout_status IS DISTINCT FROM OLD.payout_status THEN
    IF NEW.payout_status IN ('rejected'::public.payout_status_type, 'failed'::public.payout_status_type) THEN
      FOR v_alloc_rec IN
        SELECT id, talent_earning_id, affiliate_earning_id, allocated_amount
        FROM public.payout_earnings_allocations
        WHERE payout_request_id = NEW.id AND status = 'reserved'::public.payout_allocation_status_type
        FOR UPDATE
      LOOP
        IF v_alloc_rec.talent_earning_id IS NOT NULL THEN
          UPDATE public.talent_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount)
          WHERE id = v_alloc_rec.talent_earning_id;
        ELSE
          UPDATE public.talent_affiliate_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount)
          WHERE id = v_alloc_rec.affiliate_earning_id;
        END IF;
        UPDATE public.payout_earnings_allocations
        SET status = 'released_unreserved'::public.payout_allocation_status_type
        WHERE id = v_alloc_rec.id;
      END LOOP;

    ELSIF NEW.payout_status = 'completed_provider_confirmed'::public.payout_status_type THEN
      FOR v_alloc_rec IN
        SELECT id, talent_earning_id, affiliate_earning_id, allocated_amount
        FROM public.payout_earnings_allocations
        WHERE payout_request_id = NEW.id AND status = 'reserved'::public.payout_allocation_status_type
        FOR UPDATE
      LOOP
        IF v_alloc_rec.talent_earning_id IS NOT NULL THEN
          UPDATE public.talent_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount),
              paid_out_amount = paid_out_amount + v_alloc_rec.allocated_amount,
              status = CASE
                WHEN paid_out_amount + v_alloc_rec.allocated_amount >= net_earning
                  THEN 'fully_paid_out'::public.talent_earning_status_type
                ELSE 'partially_paid_out'::public.talent_earning_status_type
              END
          WHERE id = v_alloc_rec.talent_earning_id;
        ELSE
          UPDATE public.talent_affiliate_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount),
              paid_out_amount = paid_out_amount + v_alloc_rec.allocated_amount,
              status = CASE
                WHEN paid_out_amount + v_alloc_rec.allocated_amount >= reward_amount
                  THEN 'fully_paid_out'::public.talent_earning_status_type
                ELSE 'partially_paid_out'::public.talent_earning_status_type
              END
          WHERE id = v_alloc_rec.affiliate_earning_id;
        END IF;
        UPDATE public.payout_earnings_allocations
        SET status = 'settled'::public.payout_allocation_status_type
        WHERE id = v_alloc_rec.id;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_and_verify_user_identities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_can_review boolean :=
    COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR public.can_admin_access_ktp(NEW.id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_can_review THEN
      IF NEW.ktp_number IS NOT NULL AND NEW.ktp_storage_path IS NOT NULL THEN
        NEW.ktp_verification_status := 'pending_review'::public.ktp_status_type;
      ELSE
        NEW.ktp_verification_status := 'unsubmitted'::public.ktp_status_type;
      END IF;
      NEW.ktp_rejection_reason := NULL;
      NEW.verified_at := NULL;
      NEW.verified_by_admin_id := NULL;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.ktp_verification_status IS DISTINCT FROM OLD.ktp_verification_status
        OR NEW.ktp_rejection_reason IS DISTINCT FROM OLD.ktp_rejection_reason
        OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
        OR NEW.verified_by_admin_id IS DISTINCT FROM OLD.verified_by_admin_id)
       AND NOT v_can_review THEN
      RAISE EXCEPTION 'Akses Ditolak: Keputusan verifikasi KTP memerlukan izin Talent atau Support sesuai jenis akun.';
    END IF;

    IF NOT v_can_review
       AND OLD.ktp_verification_status IN ('pending_review'::public.ktp_status_type, 'verified'::public.ktp_status_type) THEN
      IF NEW.full_legal_name IS DISTINCT FROM OLD.full_legal_name
         OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
         OR NEW.ktp_number IS DISTINCT FROM OLD.ktp_number
         OR NEW.ktp_storage_path IS DISTINCT FROM OLD.ktp_storage_path THEN
        RAISE EXCEPTION 'Akses Ditolak: Data identitas legal yang sedang diproses atau sudah terverifikasi tidak dapat diubah sepihak.';
      END IF;
    END IF;

    IF NOT v_can_review AND OLD.ktp_verification_status = 'rejected'::public.ktp_status_type THEN
      IF NEW.ktp_number IS DISTINCT FROM OLD.ktp_number OR NEW.ktp_storage_path IS DISTINCT FROM OLD.ktp_storage_path THEN
        NEW.ktp_verification_status := 'pending_review'::public.ktp_status_type;
        NEW.ktp_rejection_reason := NULL;
      END IF;
    END IF;

    IF NOT v_can_review AND OLD.ktp_verification_status = 'unsubmitted'::public.ktp_status_type THEN
      IF NEW.ktp_number IS NOT NULL AND NEW.ktp_storage_path IS NOT NULL THEN
        NEW.ktp_verification_status := 'pending_review'::public.ktp_status_type;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_referral_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_referrer_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_referrer_user_id
    FROM public.talent_profiles
    WHERE referral_code = NEW.referral_code_used;

    IF v_referrer_user_id IS NULL THEN
      RAISE EXCEPTION 'Kode referral % tidak ditemukan.', NEW.referral_code_used;
    END IF;

    IF v_referrer_user_id = NEW.referee_talent_id THEN
      RAISE EXCEPTION 'Self-referral dilarang.';
    END IF;

    NEW.referrer_id := v_referrer_user_id;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.has_admin_permission('finance')
       AND session_user NOT IN ('postgres', 'supabase_admin')
       AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
      RAISE EXCEPTION 'Relasi referral hanya dapat diubah oleh Admin Keuangan.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_actor character varying;
  v_by uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    v_actor := 'system'; v_by := NULL;
  ELSIF private.is_active_admin(v_uid) THEN
    v_actor := 'admin'; v_by := v_uid;
  ELSE
    v_actor := 'user'; v_by := v_uid;
  END IF;

  INSERT INTO public.booking_status_history
    (booking_id, previous_status, new_status, changed_by_user_id, notes, actor_type)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END,
    NEW.status::text,
    v_by,
    CASE WHEN TG_OP = 'INSERT' THEN 'Reservasi dibuat' ELSE NEW.cancellation_reason END,
    v_actor
  );

  RETURN NEW;
END;
$function$;


-- User security columns: role assignment stays Super Admin/backend-only.
-- KTP-derived verification/status changes require the matching KTP permission.
CREATE OR REPLACE FUNCTION public.prevent_user_security_column_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin')
     OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.created_at IS DISTINCT FROM OLD.created_at)
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Kolom identitas sistem hanya dapat diubah oleh Super Admin.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Perubahan role hanya dapat dilakukan oleh Super Admin atau backend undangan tepercaya.';
  END IF;

  IF (NEW.is_verified_18 IS DISTINCT FROM OLD.is_verified_18
      OR NEW.account_status IS DISTINCT FROM OLD.account_status)
     AND NOT public.can_admin_access_ktp(NEW.id) THEN
    RAISE EXCEPTION 'Perubahan status verifikasi memerlukan izin KTP sesuai jenis akun.';
  END IF;

  RETURN NEW;
END;
$function$;

