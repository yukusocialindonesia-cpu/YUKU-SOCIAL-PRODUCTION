-- ============================================================================
-- MIGRATION 42: NOTIFIKASI ADMIN (UANG MASUK DLL) + REALTIME UNTUK NOTIFICATIONS
-- Aman dijalankan ulang (idempoten). Tidak mengubah tabel/enum yang sudah ada.
--
-- Mengapa perlu:
--  1. public.notifications BELUM masuk publikasi supabase_realtime, sehingga
--     lonceng di frontend tidak pernah menerima event INSERT secara live
--     (bunyi/badge baru muncul hanya saat lonceng dibuka).
--  2. Admin belum menerima notifikasi apa pun untuk uang masuk, permintaan
--     pencairan, KTP baru, laporan baru, dll.
--
-- Semua trigger di bawah dibungkus EXCEPTION handler: kegagalan membuat
-- notifikasi TIDAK PERNAH boleh menggagalkan transaksi pembayaran/booking.
-- ============================================================================

-- 1. Realtime untuk notifications ------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 2. Helper: kirim notifikasi ke semua Admin aktif -------------------------------
CREATE OR REPLACE FUNCTION public.notify_all_admins(
  p_title VARCHAR(150),
  p_message TEXT,
  p_type public.notification_type,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  SELECT u.id, p_title, p_message, p_type, p_metadata
  FROM public.users u
  WHERE u.role = 'admin'::public.user_role_type
    AND u.account_status::text NOT IN ('suspended', 'banned');
END;
$$;
REVOKE ALL ON FUNCTION public.notify_all_admins(VARCHAR, TEXT, public.notification_type, JSONB) FROM PUBLIC, anon, authenticated;

-- 3. ADMIN: bukti QRIS baru masuk (uang masuk menunggu verifikasi) ----------------
CREATE OR REPLACE FUNCTION public.notify_admin_qris_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT;
BEGIN
  BEGIN
    IF NEW.status = 'pending_review' THEN
      SELECT booking_code INTO v_code FROM public.bookings WHERE id = NEW.booking_id;
      PERFORM public.notify_all_admins(
        'Uang Masuk: Bukti QRIS Menunggu Verifikasi',
        'Customer mengunggah bukti pembayaran Rp ' ||
          replace(to_char(NEW.claimed_amount, 'FM999,999,999,999'), ',', '.') ||
          ' untuk booking ' || COALESCE(v_code, '-') || '. Segera periksa dan verifikasi.',
        'payment_status'::public.notification_type,
        jsonb_build_object('booking_id', NEW.booking_id, 'booking_code', v_code,
                           'submission_id', NEW.id, 'route', '/admin')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_qris_submitted gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_qris_submitted ON public.qris_payment_submissions;
CREATE TRIGGER trg_notify_admin_qris_submitted
AFTER INSERT ON public.qris_payment_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_qris_submitted();

-- 4. ADMIN: pembayaran Xendit (otomatis) berhasil masuk ---------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_xendit_payment_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT;
BEGIN
  BEGIN
    IF NEW.provider::text = 'xendit'
       AND NEW.payment_status = 'settled_held'::public.payment_status_type
       AND (CASE WHEN TG_OP = 'INSERT' THEN TRUE ELSE OLD.payment_status IS DISTINCT FROM NEW.payment_status END) THEN
      SELECT booking_code INTO v_code FROM public.bookings WHERE id = NEW.booking_id;
      PERFORM public.notify_all_admins(
        'Uang Masuk: Pembayaran Xendit Diterima',
        'Pembayaran Rp ' || replace(to_char(NEW.amount, 'FM999,999,999,999'), ',', '.') ||
          ' untuk booking ' || COALESCE(v_code, '-') || ' masuk dan ditahan di escrow.',
        'payment_status'::public.notification_type,
        jsonb_build_object('booking_id', NEW.booking_id, 'booking_code', v_code,
                           'payment_id', NEW.id, 'route', '/admin')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_xendit_payment_settled gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_xendit_payment_settled ON public.payments;
CREATE TRIGGER trg_notify_admin_xendit_payment_settled
AFTER INSERT OR UPDATE OF payment_status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_xendit_payment_settled();

-- 5. ADMIN: permintaan pencairan dana talent baru ---------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_payout_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM public.notify_all_admins(
      'Permintaan Pencairan Dana Baru',
      'Talent mengajukan penarikan ' || NEW.payout_number || ' sebesar Rp ' ||
        replace(to_char(NEW.amount, 'FM999,999,999,999'), ',', '.') || '. Segera proses.',
      'payout_status'::public.notification_type,
      jsonb_build_object('payout_id', NEW.id, 'payout_number', NEW.payout_number, 'route', '/admin')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_payout_requested gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_payout_requested ON public.payout_requests;
CREATE TRIGGER trg_notify_admin_payout_requested
AFTER INSERT ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_payout_requested();

-- 6. ADMIN: e-KTP baru menunggu review ---------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_ktp_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF NEW.ktp_verification_status::text = 'pending_review'
       AND (CASE WHEN TG_OP = 'INSERT' THEN TRUE ELSE OLD.ktp_verification_status IS DISTINCT FROM NEW.ktp_verification_status END) THEN
      PERFORM public.notify_all_admins(
        'e-KTP Baru Menunggu Verifikasi',
        'Ada pengajuan verifikasi e-KTP 18+ baru yang perlu ditinjau.',
        'system_alert'::public.notification_type,
        jsonb_build_object('route', '/admin')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_ktp_pending gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_ktp_pending ON public.user_identities;
CREATE TRIGGER trg_notify_admin_ktp_pending
AFTER INSERT OR UPDATE OF ktp_verification_status ON public.user_identities
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_ktp_pending();

-- 7. ADMIN: laporan insiden baru ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_report_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM public.notify_all_admins(
      'Laporan Insiden Baru',
      'Ada laporan/pengaduan baru kategori ' || NEW.category::text || ' yang perlu ditindaklanjuti.',
      'system_alert'::public.notification_type,
      jsonb_build_object('report_id', NEW.id, 'booking_id', NEW.booking_id, 'route', '/admin')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_report_created gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_report_created ON public.reports_complaints;
CREATE TRIGGER trg_notify_admin_report_created
AFTER INSERT ON public.reports_complaints
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_report_created();

-- 8. ADMIN: permintaan refund baru -------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_refund_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT;
BEGIN
  BEGIN
    IF NEW.status::text = 'requested' THEN
      SELECT booking_code INTO v_code FROM public.bookings WHERE id = NEW.booking_id;
      PERFORM public.notify_all_admins(
        'Permintaan Refund Baru',
        'Refund Rp ' || replace(to_char(NEW.refund_amount, 'FM999,999,999,999'), ',', '.') ||
          ' untuk booking ' || COALESCE(v_code, '-') || ' menunggu diproses.',
        'payment_status'::public.notification_type,
        jsonb_build_object('booking_id', NEW.booking_id, 'booking_code', v_code, 'route', '/admin')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_refund_requested gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_refund_requested ON public.refunds;
CREATE TRIGGER trg_notify_admin_refund_requested
AFTER INSERT ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_refund_requested();

-- 9. ADMIN: layanan talent baru diajukan (perlu persetujuan) -----------------------
CREATE OR REPLACE FUNCTION public.notify_admin_talent_service_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF NEW.approval_status = 'pending'
       AND (CASE WHEN TG_OP = 'INSERT' THEN TRUE ELSE OLD.approval_status IS DISTINCT FROM NEW.approval_status END) THEN
      PERFORM public.notify_all_admins(
        'Pengajuan Layanan Talent Baru',
        'Ada layanan talent yang menunggu persetujuan Admin.',
        'system_alert'::public.notification_type,
        jsonb_build_object('talent_id', NEW.talent_id, 'route', '/admin')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_talent_service_pending gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_talent_service_pending ON public.talent_services;
CREATE TRIGGER trg_notify_admin_talent_service_pending
AFTER INSERT OR UPDATE OF approval_status ON public.talent_services
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_talent_service_pending();

-- 10. TALENT: keputusan Admin atas layanan yang diajukan ----------------------------
CREATE OR REPLACE FUNCTION public.notify_talent_service_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF OLD.approval_status = 'pending' AND NEW.approval_status IN ('approved', 'rejected') THEN
      PERFORM public.create_in_app_notification(
        NEW.talent_id,
        CASE WHEN NEW.approval_status = 'approved'
             THEN 'Layanan Anda Disetujui'
             ELSE 'Layanan Anda Ditolak' END,
        CASE WHEN NEW.approval_status = 'approved'
             THEN 'Layanan yang Anda ajukan telah disetujui Admin dan kini dapat dipesan Customer.'
             ELSE 'Layanan yang Anda ajukan tidak disetujui Admin. Periksa Dashboard Talent untuk detailnya.' END,
        'system_alert'::public.notification_type,
        jsonb_build_object('route', '/dashboard-talent')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_talent_service_decision gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_talent_service_decision ON public.talent_services;
CREATE TRIGGER trg_notify_talent_service_decision
AFTER UPDATE OF approval_status ON public.talent_services
FOR EACH ROW EXECUTE FUNCTION public.notify_talent_service_decision();

-- 11. TALENT: pencairan dana mulai diproses ------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_talent_payout_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF NEW.payout_status::text = 'processing'
       AND OLD.payout_status IS DISTINCT FROM NEW.payout_status THEN
      PERFORM public.create_in_app_notification(
        NEW.talent_id,
        'Pencairan Dana Sedang Diproses',
        'Permohonan penarikan ' || NEW.payout_number || ' sedang diproses Admin.',
        'payout_status'::public.notification_type,
        jsonb_build_object('payout_id', NEW.id, 'route', '/dashboard-talent')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_talent_payout_processing gagal: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_talent_payout_processing ON public.payout_requests;
CREATE TRIGGER trg_notify_talent_payout_processing
AFTER UPDATE OF payout_status ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_talent_payout_processing();
