-- Narrow scoped Admin booking-trigger exceptions.
-- Finance and Booking Admins never bypass booking integrity triggers.
-- Support may only perform the two report-resolution transitions in its RPC.

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
    IF NEW.status_before_dispute IS DISTINCT FROM OLD.status_before_dispute
       AND pg_trigger_depth() <= 1
       AND session_user NOT IN ('postgres', 'supabase_admin')
       AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
      RAISE EXCEPTION 'Akses Ditolak: snapshot status sengketa hanya dapat diubah melalui alur moderasi laporan.';
    END IF;
    RETURN NEW;
  END IF;

  -- Support can place a booking on hold only while a related report is active.
  IF public.has_admin_permission('support')
     AND NEW.status = 'disputed_hold'::public.booking_status_type
     AND OLD.status IN (
       'paid_held_in_escrow'::public.booking_status_type,
       'confirmed_by_talent'::public.booking_status_type,
       'in_progress'::public.booking_status_type,
       'completed'::public.booking_status_type
     )
     AND NEW.status_before_dispute = COALESCE(OLD.status_before_dispute, OLD.status)
     AND EXISTS (
       SELECT 1 FROM public.reports_complaints rc
       WHERE rc.booking_id = OLD.id
         AND rc.status IN ('open'::public.report_status_type, 'investigating'::public.report_status_type)
     ) THEN
    RETURN NEW;
  END IF;

  -- Support can restore the exact pre-dispute state only after every related
  -- report is no longer open/investigating, and must clear the snapshot.
  IF public.has_admin_permission('support')
     AND OLD.status = 'disputed_hold'::public.booking_status_type
     AND OLD.status_before_dispute IS NOT NULL
     AND NEW.status = OLD.status_before_dispute
     AND NEW.status_before_dispute IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.reports_complaints rc
       WHERE rc.booking_id = OLD.id
         AND rc.status IN ('open'::public.report_status_type, 'investigating'::public.report_status_type)
     ) THEN
    RETURN NEW;
  END IF;

  -- Internal trigger cascades and trusted backend callbacks are the only
  -- generic bypasses. Scoped Admin permissions are not a trigger bypass.
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
      RAISE EXCEPTION 'Hanya peserta booking atau Admin Support melalui alur laporan yang dapat menahan booking.';
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
    RAISE EXCEPTION 'Perubahan status ini hanya boleh dilakukan backend pembayaran atau alur Admin yang berwenang.';
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
  -- Only database-owned cascades and trusted backend callbacks skip this
  -- validator. Booking/Finance/Support permissions never disable invariants.
  IF session_user IN ('postgres', 'supabase_admin')
     OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
     OR pg_trigger_depth() > 1 THEN
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
    'completed'::public.booking_status_type,
    'disputed_hold'::public.booking_status_type
  ) THEN
    IF NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_time IS DISTINCT FROM OLD.end_time
       OR NEW.duration_hours IS DISTINCT FROM OLD.duration_hours
       OR NEW.meeting_location_name IS DISTINCT FROM OLD.meeting_location_name
       OR NEW.meeting_location_address IS DISTINCT FROM OLD.meeting_location_address THEN
      RAISE EXCEPTION 'Akses Ditolak: Jadwal dan lokasi booking yang telah dibayar tidak dapat diubah sepihak.';
    END IF;
  END IF;

  -- The dispute snapshot can only be set/cleared by the tightly scoped
  -- Support transition accepted by guard_booking_status_actor().
  IF NEW.status_before_dispute IS DISTINCT FROM OLD.status_before_dispute
     AND NOT (
       public.has_admin_permission('support')
       AND (
         (
           NEW.status = 'disputed_hold'::public.booking_status_type
           AND NEW.status_before_dispute = COALESCE(OLD.status_before_dispute, OLD.status)
         )
         OR (
           OLD.status = 'disputed_hold'::public.booking_status_type
           AND OLD.status_before_dispute IS NOT NULL
           AND NEW.status = OLD.status_before_dispute
           AND NEW.status_before_dispute IS NULL
         )
       )
     ) THEN
    RAISE EXCEPTION 'Akses Ditolak: snapshot status sengketa hanya dapat dikelola melalui alur moderasi Support.';
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
    ELSIF OLD.status = 'disputed_hold'::public.booking_status_type
       AND (
         OLD.status_before_dispute IS NULL
         OR NEW.status IS DISTINCT FROM OLD.status_before_dispute
         OR NEW.status_before_dispute IS NOT NULL
         OR NOT public.has_admin_permission('support')
       ) THEN
      RAISE EXCEPTION 'Booking sengketa hanya dapat dipulihkan Support ke status sebelum sengketa setelah laporan selesai.';
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

COMMENT ON FUNCTION public.guard_booking_status_actor() IS
'Scoped Admins do not bypass booking status actor checks. Support may only hold/restore a booking through an active-report resolution flow.';
COMMENT ON FUNCTION public.validate_booking_update() IS
'Booking financial/participant snapshots are immutable to scoped Admins. Support dispute restoration is limited to the recorded pre-dispute status.';
