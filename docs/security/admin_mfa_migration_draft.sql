-- DRAFT ONLY — do not apply to Production.
-- Intended database change for mandatory MFA on Admin authorization.
-- Convert this draft into a numbered migration using:
--   supabase migration new admin_require_aal2_for_is_admin
-- before release. Keep the existing service_role bypass for trusted backend jobs.
--
-- IMPORTANT ROLLOUT ORDER:
-- 1. Deploy and test the Admin TOTP enrollment/login UI in staging.
-- 2. Enroll and verify the staging Admin account with Google Authenticator.
-- 3. Confirm its access token has aal='aal2'.
-- 4. Apply this function change to staging and run stage_f_admin_mfa_tests.sql.
-- 5. Verify Admin operations, Customer/Talent access, Storage, and backend jobs.
-- 6. Only after separate approval, repeat the process in Production.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Trusted backend jobs retain their existing service_role bypass.
  IF auth.jwt() IS NOT NULL
     AND (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- A signed-in Admin must have completed a second authentication factor.
  RETURN auth.uid() IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     AND public.get_current_user_role() = 'admin'::public.user_role_type;
END;
$function$;

COMMENT ON FUNCTION public.is_admin() IS
'Authorizes Admin sessions only after Supabase MFA AAL2; preserves service_role access for trusted backend jobs.';
