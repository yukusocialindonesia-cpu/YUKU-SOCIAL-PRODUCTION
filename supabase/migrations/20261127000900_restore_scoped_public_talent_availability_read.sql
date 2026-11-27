-- Preserve anonymous discovery while removing the legacy unrestricted schedule policy.
-- Public visitors may read availability only for fully verified/publicly visible Talents.
-- Owners and authorized Talent admins retain access to their own/private schedules.
DROP POLICY IF EXISTS talent_availability_select_visible
  ON public.talent_availability;

CREATE POLICY talent_availability_select_visible
ON public.talent_availability
FOR SELECT
TO anon, authenticated
USING (
  talent_id = (SELECT auth.uid())
  OR public.has_admin_permission('talent')
  OR public.is_talent_publicly_visible(talent_id)
);

COMMENT ON POLICY talent_availability_select_visible
ON public.talent_availability IS
'Public visitors may read availability only for publicly visible Talents; owners and authorized Talent admins may read their own/private schedules.';
