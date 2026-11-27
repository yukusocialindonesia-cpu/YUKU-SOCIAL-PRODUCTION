-- Link selfie-with-KTP evidence to the same private identity record.
ALTER TABLE public.user_identities
  ADD COLUMN IF NOT EXISTS selfie_storage_path TEXT;

-- Verification must never be approved without complete, durable evidence.
-- This trigger is deliberately narrow: it preserves the existing admin_review_ktp
-- and admin_review_talent RPC bodies, their scoped permission checks, audit logs,
-- notifications, and row-locking behavior.
CREATE OR REPLACE FUNCTION public.require_complete_ktp_evidence_before_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  v_user_role public.user_role_type;
BEGIN
  IF NEW.ktp_verification_status = 'verified'::public.ktp_status_type
     AND OLD.ktp_verification_status IS DISTINCT FROM NEW.ktp_verification_status THEN
    SELECT u.role INTO v_user_role
    FROM public.users u
    WHERE u.id = NEW.id;

    IF NULLIF(trim(COALESCE(NEW.ktp_number, '')), '') IS NULL
       OR NEW.ktp_number !~ '^[0-9]{16}

DROP TRIGGER IF EXISTS trg_require_complete_ktp_evidence
  ON public.user_identities;
CREATE TRIGGER trg_require_complete_ktp_evidence
BEFORE UPDATE OF ktp_verification_status ON public.user_identities
FOR EACH ROW
EXECUTE FUNCTION public.require_complete_ktp_evidence_before_verification();

REVOKE ALL ON FUNCTION public.require_complete_ktp_evidence_before_verification()
  FROM PUBLIC, anon, authenticated;

-- Protect existing account sanctions from the Talent review RPC and any other
-- non-Super-Admin account-status update. Explicit Super Admin account management
-- remains the only supported path to change a suspended/banned account.
CREATE OR REPLACE FUNCTION public.prevent_scoped_admin_sanction_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.account_status IN (
       'suspended'::public.account_status_type,
       'banned'::public.account_status_type
     )
     AND NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT public.is_super_admin()
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Status akun suspended/banned hanya dapat diubah melalui tindakan Super Admin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_scoped_admin_sanction_override
  ON public.users;
CREATE TRIGGER trg_prevent_scoped_admin_sanction_override
BEFORE UPDATE OF account_status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_scoped_admin_sanction_override();

REVOKE ALL ON FUNCTION public.prevent_scoped_admin_sanction_override()
  FROM PUBLIC, anon, authenticated;

       OR NULLIF(trim(COALESCE(NEW.ktp_storage_path, '')), '') IS NULL
       OR (
         v_user_role = 'customer'::public.user_role_type
         AND NULLIF(trim(COALESCE(NEW.selfie_storage_path, '')), '') IS NULL
       ) THEN
      RAISE EXCEPTION 'Verifikasi ditolak: NIK 16 digit dan foto e-KTP wajib tersedia; Customer juga wajib memiliki selfie dengan KTP.';
    END IF;
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_require_complete_ktp_evidence
  ON public.user_identities;
CREATE TRIGGER trg_require_complete_ktp_evidence
BEFORE UPDATE OF ktp_verification_status ON public.user_identities
FOR EACH ROW
EXECUTE FUNCTION public.require_complete_ktp_evidence_before_verification();

REVOKE ALL ON FUNCTION public.require_complete_ktp_evidence_before_verification()
  FROM PUBLIC, anon, authenticated;

-- Protect existing account sanctions from the Talent review RPC and any other
-- non-Super-Admin account-status update. Explicit Super Admin account management
-- remains the only supported path to change a suspended/banned account.
CREATE OR REPLACE FUNCTION public.prevent_scoped_admin_sanction_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.account_status IN (
       'suspended'::public.account_status_type,
       'banned'::public.account_status_type
     )
     AND NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT public.is_super_admin()
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Status akun suspended/banned hanya dapat diubah melalui tindakan Super Admin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_scoped_admin_sanction_override
  ON public.users;
CREATE TRIGGER trg_prevent_scoped_admin_sanction_override
BEFORE UPDATE OF account_status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_scoped_admin_sanction_override();

REVOKE ALL ON FUNCTION public.prevent_scoped_admin_sanction_override()
  FROM PUBLIC, anon, authenticated;
