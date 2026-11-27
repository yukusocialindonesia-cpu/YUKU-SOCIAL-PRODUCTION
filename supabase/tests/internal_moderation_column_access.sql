-- Regression assertions for internal moderation column access.
DO $$
DECLARE
  v_failed text[] := ARRAY[]::text[];
BEGIN
  IF has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'admin_notes', 'SELECT')
     OR has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'admin_decision', 'SELECT')
     OR has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'payment_id', 'SELECT')
     OR has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'resolved_by_admin_id', 'SELECT')
     OR has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'resolved_at', 'SELECT') THEN
    v_failed := array_append(v_failed, 'customer cancellation internal columns remain readable');
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'status', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.customer_cancellation_cases', 'admin_hold_until', 'SELECT') THEN
    v_failed := array_append(v_failed, 'customer/finance-safe cancellation columns are not readable');
  END IF;

  IF has_column_privilege('authenticated', 'public.reports_complaints', 'admin_notes', 'SELECT')
     OR has_column_privilege('authenticated', 'public.reports_complaints', 'resolved_by_admin_id', 'SELECT') THEN
    v_failed := array_append(v_failed, 'report moderation columns remain readable directly');
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.reports_complaints', 'status', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.reports_complaints', 'description', 'SELECT') THEN
    v_failed := array_append(v_failed, 'reporter-safe columns are not readable');
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_support_admin_reports()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_support_admin_reports()', 'EXECUTE')
     OR has_function_privilege('public', 'public.get_support_admin_reports()', 'EXECUTE') THEN
    v_failed := array_append(v_failed, 'support reports RPC grants are incorrect');
  END IF;

  IF cardinality(v_failed) > 0 THEN
    RAISE EXCEPTION 'Internal moderation access regression failed: %', array_to_string(v_failed, '; ');
  END IF;
END $$;
