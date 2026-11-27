-- Restrict reporter access to safe fields; Admin reads full rows via the guarded Support RPC.
REVOKE SELECT ON TABLE public.reports_complaints FROM authenticated;
REVOKE SELECT (
  id, reporter_id, reported_user_id, booking_id, category,
  description, evidence_urls, status, admin_notes,
  resolved_by_admin_id, created_at
) ON TABLE public.reports_complaints FROM authenticated;
GRANT SELECT (
  id, reporter_id, reported_user_id, booking_id, category,
  description, evidence_urls, status, created_at
) ON TABLE public.reports_complaints TO authenticated;
