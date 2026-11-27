-- Restrict incident report internal moderation fields to Support Admin RPC.
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

CREATE OR REPLACE FUNCTION public.get_support_admin_reports()
RETURNS SETOF public.reports_complaints
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('support') THEN
    RAISE EXCEPTION 'Akses ditolak: izin Support diperlukan.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT r.*
    FROM public.reports_complaints AS r
    ORDER BY r.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_support_admin_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_admin_reports() TO authenticated;
