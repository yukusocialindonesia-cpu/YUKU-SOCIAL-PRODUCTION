-- Allow anonymous sessions to evaluate RLS policies that include admin checks.
-- Both public wrappers derive identity exclusively from auth.uid(); for anon,
-- auth.uid() is NULL and the helpers return false. This does not grant admin
-- access or expose admin records; it prevents permission errors while public
-- rows are filtered by the existing RLS predicates.
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO anon;
