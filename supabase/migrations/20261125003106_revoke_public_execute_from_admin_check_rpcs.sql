-- Keep admin permission-check RPCs available to signed-in clients only.
-- The function bodies still enforce active admin identity and permissions.
REVOKE ALL ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
