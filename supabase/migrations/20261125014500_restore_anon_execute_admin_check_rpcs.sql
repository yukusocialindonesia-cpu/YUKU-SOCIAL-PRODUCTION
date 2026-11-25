-- Allow anonymous visitors to evaluate public RLS policies that call these checks.
-- Both functions resolve auth.uid() and return false when no user is authenticated.
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
