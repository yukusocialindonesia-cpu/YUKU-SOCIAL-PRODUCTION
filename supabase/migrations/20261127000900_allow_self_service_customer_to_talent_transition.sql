-- Restore the intended Customer -> Talent self-service transition without
-- reopening arbitrary role changes. Migration 62 made all role changes
-- Super-Admin/backend-only, which unintentionally blocked become_talent().
-- The RPC itself remains SECURITY DEFINER and only updates auth.uid()'s own row.

CREATE OR REPLACE FUNCTION public.prevent_user_security_column_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_self_service_talent_upgrade boolean :=
    auth.uid() IS NOT NULL
    AND auth.uid() = OLD.id
    AND NEW.id = OLD.id
    AND OLD.role = 'customer'::public.user_role_type
    AND NEW.role = 'talent'::public.user_role_type
    AND NEW.email IS NOT DISTINCT FROM OLD.email
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    AND NEW.is_verified_18 IS NOT DISTINCT FROM OLD.is_verified_18
    AND NEW.account_status IS NOT DISTINCT FROM OLD.account_status;
BEGIN
  -- Trusted database/backend operations remain permitted.
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
     AND NOT public.is_super_admin()
     AND NOT v_self_service_talent_upgrade THEN
    RAISE EXCEPTION 'Perubahan role hanya dapat dilakukan oleh Super Admin atau melalui pendaftaran Talent milik akun sendiri.';
  END IF;

  IF (NEW.is_verified_18 IS DISTINCT FROM OLD.is_verified_18
      OR NEW.account_status IS DISTINCT FROM OLD.account_status)
     AND NOT public.can_admin_access_ktp(NEW.id) THEN
    RAISE EXCEPTION 'Perubahan status verifikasi memerlukan izin KTP sesuai jenis akun.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_user_security_column_tampering()
  FROM PUBLIC, anon, authenticated;
