-- Public RLS policies still evaluate these helpers for anonymous visitors.
-- Both SECURITY DEFINER wrappers derive identity only from auth.uid(); the
-- private implementations explicitly return false when the user id is NULL.
-- This restores policy evaluation without granting anonymous admin privileges.
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
