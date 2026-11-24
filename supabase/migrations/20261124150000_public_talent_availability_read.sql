-- Allow anonymous visitors to read availability only for publicly visible Talents.
-- Keep private schedules scoped to their owner and authorized Talent admins.
-- Public visibility is gated by active account, age/KTP verification,
-- approved Talent profile, and at least one approved active service.

DROP POLICY IF EXISTS talent_availability_select_public
  ON public.talent_availability;
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
'Owners and authorized Talent admins can read schedules; anonymous and authenticated visitors can read schedules only for publicly visible Talents.';
