-- Restrict helper RPC exposure. These helpers return admin state and are only
-- meaningful for authenticated sessions. Trigger execution does not require
-- callers to have EXECUTE on the trigger function.
REVOKE ALL ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.guard_talent_media_moderation_fields() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.has_admin_permission(text) IS
  'Authenticated-only admin permission helper; anonymous RPC access is intentionally disabled.';
COMMENT ON FUNCTION public.is_super_admin() IS
  'Authenticated-only super-admin helper; anonymous RPC access is intentionally disabled.';
COMMENT ON FUNCTION public.guard_talent_media_moderation_fields() IS
  'Trigger-only guard for talent media moderation fields; direct RPC execution is disabled.';
