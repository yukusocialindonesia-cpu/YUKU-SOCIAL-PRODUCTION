-- Align the legacy Production availability policy with the scoped Admin model.
-- Production still has a permissive public SELECT policy that exposes every
-- talent_availability row. Staging already uses this authenticated, scoped rule.
DROP POLICY IF EXISTS talent_availability_select_public ON public.talent_availability;
DROP POLICY IF EXISTS talent_availability_select_visible ON public.talent_availability;

CREATE POLICY talent_availability_select_visible
ON public.talent_availability
FOR SELECT
TO authenticated
USING (
  talent_id = auth.uid()
  OR public.has_admin_permission('talent')
  OR public.is_talent_publicly_visible(talent_id)
);

