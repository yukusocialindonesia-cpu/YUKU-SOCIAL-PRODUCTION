-- Keep public category reads independent from admin-only authorization helpers.
-- Anonymous visitors may read active categories only.
DROP POLICY IF EXISTS activity_categories_select_public ON public.activity_categories;

CREATE POLICY activity_categories_select_anon
ON public.activity_categories
FOR SELECT
TO anon
USING (is_active = true);

-- Signed-in users retain active-category access; authorized admins can also
-- inspect inactive categories for management.
CREATE POLICY activity_categories_select_authenticated
ON public.activity_categories
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR public.is_super_admin()
  OR public.has_admin_permission('talent')
);
