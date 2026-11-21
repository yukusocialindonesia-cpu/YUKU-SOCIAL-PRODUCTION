-- YUKU migration 48: safe foundation for Super Admin and per-menu Admin permissions.
-- This migration does NOT change public.is_admin(), existing RLS policies, RPC guards,
-- Storage policies, user roles, age verification, account status, or Production.
-- It only creates the permission registry and read-only access helpers.
-- Bootstrap is performed from trusted migration context using the existing owner account.

CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE TABLE IF NOT EXISTS private.admin_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  admin_level text NOT NULL DEFAULT 'admin'
    CHECK (admin_level IN ('super_admin', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.admin_permissions (
  admin_user_id uuid NOT NULL
    REFERENCES private.admin_accounts(user_id) ON DELETE CASCADE,
  permission_key text NOT NULL
    CHECK (permission_key IN ('talent', 'booking', 'finance', 'support')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (admin_user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS admin_accounts_active_level_idx
  ON private.admin_accounts (admin_level, is_active);
CREATE INDEX IF NOT EXISTS admin_permissions_key_idx
  ON private.admin_permissions (permission_key, admin_user_id);

ALTER TABLE private.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE private.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_permissions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.admin_accounts, private.admin_permissions
  FROM PUBLIC, anon, authenticated, service_role;

-- Internal helper: only active accounts whose public profile is still an Admin
-- are recognized. Age verification and account_status are intentionally ignored.
CREATE OR REPLACE FUNCTION private.is_active_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM private.admin_accounts aa
      JOIN public.users u ON u.id = aa.user_id
      WHERE aa.user_id = p_user_id
        AND aa.is_active IS TRUE
        AND u.role = 'admin'::public.user_role_type
    );
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_active_admin(p_user_id)
    AND EXISTS (
      SELECT 1
      FROM private.admin_accounts aa
      WHERE aa.user_id = p_user_id
        AND aa.admin_level = 'super_admin'
    );
$$;

CREATE OR REPLACE FUNCTION private.has_admin_permission(
  p_user_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_permission IN ('talent', 'booking', 'finance', 'support')
    AND private.is_active_admin(p_user_id)
    AND (
      private.is_super_admin(p_user_id)
      OR EXISTS (
        SELECT 1
        FROM private.admin_permissions ap
        WHERE ap.admin_user_id = p_user_id
          AND ap.permission_key = p_permission
      )
    );
$$;

REVOKE ALL ON FUNCTION private.is_active_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_admin_permission(uuid, text) FROM PUBLIC, anon, authenticated;

-- Safe frontend read: returns only the current user's own Admin level and menu keys.
CREATE OR REPLACE FUNCTION public.get_admin_access()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN private.is_active_admin(auth.uid()) THEN
      jsonb_build_object(
        'is_admin', true,
        'is_super_admin', private.is_super_admin(auth.uid()),
        'permissions',
          CASE
            WHEN private.is_super_admin(auth.uid())
              THEN jsonb_build_array('talent', 'booking', 'finance', 'support')
            ELSE COALESCE((
              SELECT jsonb_agg(ap.permission_key ORDER BY ap.permission_key)
              FROM private.admin_permissions ap
              WHERE ap.admin_user_id = auth.uid()
            ), '[]'::jsonb)
          END
      )
    ELSE jsonb_build_object(
      'is_admin', false,
      'is_super_admin', false,
      'permissions', '[]'::jsonb
    )
  END;
$$;

-- Safe boolean helper for later RLS/RPC hardening. It cannot grant access to
-- another user because the subject always comes from auth.uid().
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.has_admin_permission(auth.uid(), p_permission);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_super_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_admin_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Bootstrap the already-existing owner account as the first Super Admin.
-- This is a trusted migration lookup, not a frontend authorization check.
DO $$
DECLARE
  v_user_id uuid;
  v_count integer;
BEGIN
  SELECT count(*), min(id::text)::uuid
    INTO v_count, v_user_id
  FROM auth.users
  WHERE lower(email) = lower('yukusocial@gmail.com');

  IF v_count <> 1 OR v_user_id IS NULL THEN
    RAISE EXCEPTION
      'Bootstrap Super Admin dihentikan: akun yukusocial@gmail.com harus ditemukan tepat satu kali.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_user_id AND role = 'admin'::public.user_role_type
  ) THEN
    RAISE EXCEPTION
      'Bootstrap Super Admin dihentikan: akun pemilik belum memiliki role admin di public.users.';
  END IF;

  INSERT INTO private.admin_accounts (user_id, admin_level, is_active)
  VALUES (v_user_id, 'super_admin', true)
  ON CONFLICT (user_id) DO UPDATE
    SET admin_level = 'super_admin',
        is_active = true,
        updated_at = now();
END;
$$;

COMMENT ON TABLE private.admin_accounts IS
  'Internal registry for the two YUKU admin levels: super_admin and admin.';
COMMENT ON TABLE private.admin_permissions IS
  'Menu permissions for a single Admin account type: talent, booking, finance, support.';
COMMENT ON FUNCTION public.get_admin_access() IS
  'Returns only the current authenticated user own Admin level and menu permissions.';
COMMENT ON FUNCTION public.has_admin_permission(text) IS
  'Checks the current authenticated user permission for one YUKU Admin menu.';
