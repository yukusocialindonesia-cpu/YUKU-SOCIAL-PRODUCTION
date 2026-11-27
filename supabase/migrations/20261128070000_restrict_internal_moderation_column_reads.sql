-- Prevent authenticated users from reading internal moderation metadata.
-- Customer/Finance-safe columns remain available under existing RLS policies.
REVOKE SELECT ON TABLE public.customer_cancellation_cases FROM authenticated;
REVOKE SELECT (
  id, booking_id, payment_id, customer_id, gross_amount,
  automatic_refund_amount, retained_pending_admin_amount,
  hours_before_session, policy_code, status, admin_decision,
  admin_notes, resolved_by_admin_id, resolved_at, created_at,
  admin_hold_until
) ON TABLE public.customer_cancellation_cases FROM authenticated;
GRANT SELECT (
  id, booking_id, customer_id, gross_amount,
  automatic_refund_amount, retained_pending_admin_amount,
  hours_before_session, policy_code, status, created_at,
  admin_hold_until
) ON TABLE public.customer_cancellation_cases TO authenticated;

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

-- Support Admins retain access to full moderation records only through this
-- permission-checked RPC. The SECURITY DEFINER owner bypasses row/column RLS,
-- so the permission check is mandatory and kept inside the function.
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
