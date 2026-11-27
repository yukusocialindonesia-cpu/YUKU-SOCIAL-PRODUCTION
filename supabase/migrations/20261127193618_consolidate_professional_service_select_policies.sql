-- Records the policy consolidation already applied to Supabase Production.
-- Owner access and Admin talent-review access remain unchanged; the SELECT
-- policies are combined to avoid repeated permissive-policy evaluation.

DROP POLICY IF EXISTS professional_service_status_history_admin_read
  ON public.professional_service_application_status_history;
DROP POLICY IF EXISTS professional_service_status_history_owner_read
  ON public.professional_service_application_status_history;
CREATE POLICY professional_service_status_history_read
  ON public.professional_service_application_status_history
  FOR SELECT TO authenticated
  USING (
    (is_super_admin() OR has_admin_permission('talent'::text))
    OR EXISTS (
      SELECT 1
      FROM public.professional_service_applications a
      WHERE a.id = professional_service_application_status_history.application_id
        AND a.applicant_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS professional_service_applications_admin_read
  ON public.professional_service_applications;
DROP POLICY IF EXISTS professional_service_applications_owner_read
  ON public.professional_service_applications;
CREATE POLICY professional_service_applications_read
  ON public.professional_service_applications
  FOR SELECT TO authenticated
  USING (
    applicant_id = (SELECT auth.uid())
    OR is_super_admin()
    OR has_admin_permission('talent'::text)
  );
