-- Stage F: tests for the two-level Admin registry and per-menu permissions.
-- Run after migration 48 on a dedicated Staging database.
-- Temporary Admin setup below is wrapped in a transaction and rolled back.

DO $$
DECLARE
  v_owner_id uuid;
  v_regular_id uuid;
BEGIN
  SELECT aa.user_id INTO v_owner_id
  FROM private.admin_accounts aa
  JOIN public.users u ON u.id = aa.user_id
  WHERE lower(u.email) = lower('yukusocial@gmail.com')
    AND aa.admin_level = 'super_admin'
    AND aa.is_active IS TRUE
    AND u.role = 'admin'::public.user_role_type;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: initial Super Admin is not correctly registered';
  END IF;

  IF NOT private.has_admin_permission(v_owner_id, 'talent')
     OR NOT private.has_admin_permission(v_owner_id, 'booking')
     OR NOT private.has_admin_permission(v_owner_id, 'finance')
     OR NOT private.has_admin_permission(v_owner_id, 'support') THEN
    RAISE EXCEPTION 'FAIL: Super Admin must have all four menu permissions';
  END IF;

  SELECT id INTO v_regular_id
  FROM public.users
  WHERE role <> 'admin'::public.user_role_type
  ORDER BY created_at
  LIMIT 1;

  IF v_regular_id IS NOT NULL THEN
    IF private.is_active_admin(v_regular_id)
       OR private.is_super_admin(v_regular_id)
       OR private.has_admin_permission(v_regular_id, 'talent') THEN
      RAISE EXCEPTION 'FAIL: ordinary user was granted Admin access';
    END IF;
  END IF;

  IF has_schema_privilege('authenticated', 'private', 'USAGE')
     OR has_table_privilege('authenticated', 'private.admin_accounts', 'SELECT')
     OR has_table_privilege('authenticated', 'private.admin_permissions', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can directly access private Admin registry';
  END IF;

  IF has_function_privilege('anon', 'public.get_admin_access()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute get_admin_access';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_admin_access()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.has_admin_permission(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot read its own Admin access state';
  END IF;
END;
$$;

BEGIN;
DO $$
DECLARE
  v_test_user_id uuid;
  v_access jsonb;
BEGIN
  SELECT id INTO v_test_user_id
  FROM public.users
  WHERE role = 'talent'::public.user_role_type
  ORDER BY created_at
  LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: no existing Talent account available for rollback-only permission test';
  END IF;

  -- Temporary test-only promotion; the transaction is rolled back below.
  UPDATE public.users
  SET role = 'admin'::public.user_role_type
  WHERE id = v_test_user_id;

  INSERT INTO private.admin_accounts (user_id, admin_level, is_active)
  VALUES (v_test_user_id, 'admin', true);

  INSERT INTO private.admin_permissions (admin_user_id, permission_key)
  VALUES (v_test_user_id, 'talent');

  PERFORM set_config('request.jwt.claim.sub', v_test_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_access := public.get_admin_access();

  IF v_access->>'is_admin' <> 'true'
     OR v_access->>'is_super_admin' <> 'false'
     OR v_access->'permissions' <> '["talent"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: Admin with Talent permission received unexpected access: %', v_access;
  END IF;

  IF NOT public.has_admin_permission('talent')
     OR public.has_admin_permission('booking')
     OR public.has_admin_permission('finance')
     OR public.has_admin_permission('support')
     OR public.is_super_admin() THEN
    RAISE EXCEPTION 'FAIL: single-menu Admin permission boundary failed';
  END IF;
END;
$$;
ROLLBACK;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.admin_accounts aa
    JOIN public.users u ON u.id = aa.user_id
    WHERE u.role <> 'admin'::public.user_role_type
  ) THEN
    RAISE EXCEPTION 'FAIL: test-only Admin state was not rolled back';
  END IF;
  RAISE NOTICE 'PASS: Stage F Admin access foundation tests completed';
END;
$$;
