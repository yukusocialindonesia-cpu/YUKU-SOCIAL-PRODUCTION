-- YUKU Stage F — Admin MFA authorization test.
-- Run only after the Admin MFA function migration is applied to STAGING.
-- Read-only assertions; no persistent rows are inserted or updated.

DO $$
DECLARE
  v_admin_id UUID;
  v_customer_id UUID;
  v_passed INTEGER := 0;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE role = 'admin'::public.user_role_type
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_customer_id
  FROM public.users
  WHERE role = 'customer'::public.user_role_type
  ORDER BY created_at
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: staging tidak memiliki akun Admin untuk pengujian.';
  END IF;

  -- Admin with password-only session (AAL1) must be denied.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_admin_id::text, 'aal', 'aal1')::text,
    true
  );
  IF public.is_admin() THEN
    RAISE EXCEPTION 'FAIL: Admin AAL1 masih diberi akses.';
  END IF;
  v_passed := v_passed + 1;

  -- Admin with verified second factor (AAL2) must be allowed.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_admin_id::text, 'aal', 'aal2')::text,
    true
  );
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FAIL: Admin AAL2 tidak mendapat akses.';
  END IF;
  v_passed := v_passed + 1;

  -- Customer must remain denied even if the token says AAL2.
  IF v_customer_id IS NOT NULL THEN
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'sub', v_customer_id::text, 'aal', 'aal2')::text,
      true
    );
    IF public.is_admin() THEN
      RAISE EXCEPTION 'FAIL: Customer AAL2 mendapat akses Admin.';
    END IF;
    v_passed := v_passed + 1;
  END IF;

  -- Trusted service_role backend access must remain functional.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FAIL: service_role kehilangan akses backend.';
  END IF;
  v_passed := v_passed + 1;

  RAISE NOTICE 'PASS: % pemeriksaan Admin MFA berhasil.', v_passed;
END;
$$;
