-- Force report moderation through the audited, row-locked Support RPC.
-- The SECURITY DEFINER function owner retains its own UPDATE privilege.
REVOKE UPDATE ON TABLE public.reports_complaints FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status, admin_notes, resolved_by_admin_id)
  ON TABLE public.reports_complaints FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS reports_update_admin ON public.reports_complaints;
DROP POLICY IF EXISTS "reports_update_admin" ON public.reports_complaints;

COMMENT ON TABLE public.reports_complaints IS
  'Report moderation writes must use public.admin_resolve_report(); direct app-role UPDATE is revoked to preserve row locking and audit logging.';
