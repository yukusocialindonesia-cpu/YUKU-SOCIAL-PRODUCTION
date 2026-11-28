-- Preserve trusted database-owner and service-role maintenance paths while
-- requiring scoped KTP permission for user-facing Admin decisions.
CREATE OR REPLACE FUNCTION public.protect_and_verify_user_identities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_can_review boolean :=
    session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
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

