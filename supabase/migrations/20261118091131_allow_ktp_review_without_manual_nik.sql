-- YUKU: NIK manual tidak lagi diwajibkan.
-- Dokumen KTP privat tetap wajib; nama legal dan tanggal lahir tetap divalidasi.

CREATE OR REPLACE FUNCTION public.guard_ktp_verified_requires_valid_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.ktp_verification_status = 'verified'::public.ktp_status_type THEN
    IF NEW.date_of_birth IS NULL
       OR NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
      RAISE EXCEPTION 'KTP tidak dapat diverifikasi: pemilik harus berusia minimal 18 tahun.';
    END IF;

    IF NULLIF(trim(COALESCE(NEW.full_legal_name, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(NEW.ktp_storage_path, '')), '') IS NULL THEN
      RAISE EXCEPTION 'KTP tidak dapat diverifikasi: nama legal, tanggal lahir, dan dokumen wajib tersedia.';
    END IF;

    IF left(NEW.ktp_storage_path, char_length(NEW.id::text || '/')) <> NEW.id::text || '/' THEN
      RAISE EXCEPTION 'KTP tidak dapat diverifikasi: lokasi dokumen tidak sesuai dengan pemilik akun.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'ktp-documents'
        AND o.name = NEW.ktp_storage_path
        AND (o.owner = NEW.id OR o.owner_id = NEW.id::text)
    ) THEN
      RAISE EXCEPTION 'KTP tidak dapat diverifikasi: file tidak ditemukan atau bukan milik akun tersebut.';
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
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NOT public.is_admin() THEN
      IF NULLIF(trim(COALESCE(NEW.full_legal_name, '')), '') IS NOT NULL
         AND NEW.date_of_birth IS NOT NULL
         AND NULLIF(trim(COALESCE(NEW.ktp_storage_path, '')), '') IS NOT NULL THEN
        NEW.ktp_verification_status := 'pending_review'::public.ktp_status_type;
      ELSE
        NEW.ktp_verification_status := 'unsubmitted'::public.ktp_status_type;
      END IF;
      NEW.ktp_rejection_reason := NULL;
      NEW.verified_at := NULL;
      NEW.verified_by_admin_id := NULL;
    END IF;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Status dan keputusan verifikasi hanya dapat diubah admin.
    IF (NEW.ktp_verification_status IS DISTINCT FROM OLD.ktp_verification_status OR
        NEW.ktp_rejection_reason IS DISTINCT FROM OLD.ktp_rejection_reason OR
        NEW.verified_at IS DISTINCT FROM OLD.verified_at OR
        NEW.verified_by_admin_id IS DISTINCT FROM OLD.verified_by_admin_id) THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses Ditolak: Status verifikasi KTP dan keputusan admin hanya dapat diperbarui oleh Admin YUKU.';
      END IF;
    END IF;

    -- Data identitas yang sedang ditinjau/terverifikasi tidak dapat diubah sepihak.
    IF NOT public.is_admin() AND OLD.ktp_verification_status IN ('pending_review'::public.ktp_status_type, 'verified'::public.ktp_status_type) THEN
      IF NEW.full_legal_name IS DISTINCT FROM OLD.full_legal_name OR
         NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR
         NEW.ktp_number IS DISTINCT FROM OLD.ktp_number OR
         NEW.ktp_storage_path IS DISTINCT FROM OLD.ktp_storage_path THEN
        RAISE EXCEPTION 'Akses Ditolak: Data identitas legal yang sedang diproses atau sudah terverifikasi tidak dapat diubah sepihak.';
      END IF;
    END IF;

    -- Pengajuan yang ditolak dapat diajukan ulang setelah dokumen KTP diganti.
    IF NOT public.is_admin() AND OLD.ktp_verification_status = 'rejected'::public.ktp_status_type THEN
      IF NEW.ktp_storage_path IS DISTINCT FROM OLD.ktp_storage_path
         AND NULLIF(trim(COALESCE(NEW.full_legal_name, '')), '') IS NOT NULL
         AND NEW.date_of_birth IS NOT NULL
         AND NULLIF(trim(COALESCE(NEW.ktp_storage_path, '')), '') IS NOT NULL THEN
        NEW.ktp_verification_status := 'pending_review'::public.ktp_status_type;
        NEW.ktp_rejection_reason := NULL;
      END IF;
    END IF;

    -- Unggahan dokumen dari status unsubmitted masuk antrean admin tanpa NIK manual.
    IF NOT public.is_admin() AND OLD.ktp_verification_status = 'unsubmitted'::public.ktp_status_type THEN
      IF NULLIF(trim(COALESCE(NEW.full_legal_name, '')), '') IS NOT NULL
         AND NEW.date_of_birth IS NOT NULL
         AND NULLIF(trim(COALESCE(NEW.ktp_storage_path, '')), '') IS NOT NULL THEN
        NEW.ktp_verification_status := 'pending_review'::public.ktp_status_type;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;