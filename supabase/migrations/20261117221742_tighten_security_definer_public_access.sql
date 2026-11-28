REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_admin_user(uuid) FROM authenticated, anon;
