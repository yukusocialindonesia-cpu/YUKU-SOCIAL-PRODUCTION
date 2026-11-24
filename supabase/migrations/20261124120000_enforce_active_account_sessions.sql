-- Block suspended/banned authenticated sessions at the database boundary.
-- Additive guard: existing RLS policies remain in place; restrictive policies
-- require an eligible account for authenticated access to application tables.
-- The users table retains its existing self-only SELECT policy so AuthContext
-- can detect suspension; its writes are still blocked by the BEFORE trigger.
-- Trusted service-role and database/cron work continue to operate.

CREATE OR REPLACE FUNCTION private.is_current_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.account_status IN (
        'active'::public.account_status_type,
        'pending_verification'::public.account_status_type
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.is_current_user_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_current_user_active() TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_active_account_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid;
  v_status public.account_status_type;
BEGIN
  v_actor := auth.uid();
  -- Trusted service-role/backend/cron work has no end-user identity.
  -- Anonymous requests remain subject to their existing RLS/grants.
  IF v_actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Allow only the initial profile row for the current Auth user.
  -- Keep NEW.id access inside the table/operation checks: other public tables
  -- (for example community_likes and system_feature_flags) have no id column.
  IF TG_TABLE_SCHEMA = 'public' THEN
    IF TG_TABLE_NAME = 'users' THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.id = v_actor THEN
          RETURN NEW;
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT u.account_status INTO v_status
  FROM public.users u
  WHERE u.id = v_actor;

  IF v_status IS NULL OR v_status NOT IN (
    'active'::public.account_status_type,
    'pending_verification'::public.account_status_type
  ) THEN
    RAISE EXCEPTION 'Akun sedang dinonaktifkan dan tidak dapat melakukan perubahan.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_active_account_write() FROM PUBLIC, anon, authenticated;

DO $block$
DECLARE
  v_table record;
BEGIN
  -- A BEFORE trigger also protects writes inside SECURITY DEFINER RPCs,
  -- where ordinary RLS checks may be bypassed. Install on partition roots;
  -- PostgreSQL propagates those triggers to their partitions.
  FOR v_table IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_guard_active_account_write ON %I.%I',
      v_table.schema_name, v_table.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER trg_guard_active_account_write
       BEFORE INSERT OR UPDATE OR DELETE ON %I.%I
       FOR EACH ROW EXECUTE FUNCTION private.guard_active_account_write()',
      v_table.schema_name, v_table.table_name
    );

    -- Keep public.users readable through its existing self-only SELECT policy.
    -- AuthContext must be able to read account_status to detect suspension and
    -- sign the user out. The BEFORE trigger below still blocks inactive writes.
    IF v_table.relrowsecurity
       AND v_table.table_name <> 'users'
       AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = v_table.schema_name
        AND p.tablename = v_table.table_name
        AND p.policyname = 'account_status_active_guard'
    ) THEN
      EXECUTE format(
        'CREATE POLICY account_status_active_guard ON %I.%I
         AS RESTRICTIVE FOR ALL TO authenticated
         USING (private.is_current_user_active())
         WITH CHECK (private.is_current_user_active())',
        v_table.schema_name, v_table.table_name
      );
    END IF;
  END LOOP;

  -- Private user uploads are also protected by the same account guard.
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_active_account_write ON storage.objects';
    EXECUTE 'CREATE TRIGGER trg_guard_active_account_write
             BEFORE INSERT OR UPDATE OR DELETE ON storage.objects
             FOR EACH ROW EXECUTE FUNCTION private.guard_active_account_write()';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'account_status_active_guard'
    ) THEN
      EXECUTE 'CREATE POLICY account_status_active_guard ON storage.objects
               AS RESTRICTIVE FOR ALL TO authenticated
               USING (private.is_current_user_active())
               WITH CHECK (private.is_current_user_active())';
    END IF;
  END IF;
END;
$block$;


-- Keep every admin RPC/SECURITY DEFINER authorization helper tied to the
-- current database account status, not only the Admin panel's session state.
CREATE OR REPLACE FUNCTION private.is_active_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM private.admin_accounts aa
      JOIN public.users u ON u.id = aa.user_id
      WHERE aa.user_id = p_user_id
        AND aa.is_active IS TRUE
        AND u.role = 'admin'::public.user_role_type
        AND u.account_status = 'active'::public.account_status_type
    );
$function$;


-- SECURITY DEFINER reads bypass table RLS, so explicitly guard this
-- authenticated personal-data RPC as well.
CREATE OR REPLACE FUNCTION public.get_my_referral_network()
RETURNS TABLE(
  id uuid,
  referee_talent_id uuid,
  referee_name text,
  referee_city text,
  referee_account_status text,
  referral_code_used character varying,
  is_active boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL OR NOT private.is_current_user_active() THEN
    RAISE EXCEPTION 'Akun tidak aktif atau autentikasi diperlukan.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    rr.id,
    rr.referee_talent_id,
    COALESCE(tp.display_name, 'Talent Terdaftar')::text,
    COALESCE(tp.city, '-')::text,
    COALESCE(u.account_status::text, 'pending_verification'),
    rr.referral_code_used,
    rr.is_active,
    rr.created_at
  FROM public.referral_relationships rr
  LEFT JOIN public.talent_profiles tp ON tp.id = rr.referee_talent_id
  LEFT JOIN public.users u ON u.id = rr.referee_talent_id
  WHERE rr.referrer_id = v_caller_id
  ORDER BY rr.created_at DESC;
END;
$function$;
