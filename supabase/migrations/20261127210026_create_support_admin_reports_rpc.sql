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
