-- Restrict Customer/Finance access to safe cancellation-case fields only.
-- Keep clean migration replay resilient when the legacy table is not present.
DO $$
BEGIN
  IF to_regclass('public.customer_cancellation_cases') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON TABLE public.customer_cancellation_cases FROM authenticated';
    EXECUTE 'REVOKE SELECT (
      id, booking_id, payment_id, customer_id, gross_amount,
      automatic_refund_amount, retained_pending_admin_amount,
      hours_before_session, policy_code, status, admin_decision,
      admin_notes, resolved_by_admin_id, resolved_at, created_at,
      admin_hold_until
    ) ON TABLE public.customer_cancellation_cases FROM authenticated';
    EXECUTE 'GRANT SELECT (
      id, booking_id, customer_id, gross_amount,
      automatic_refund_amount, retained_pending_admin_amount,
      hours_before_session, policy_code, status, created_at,
      admin_hold_until
    ) ON TABLE public.customer_cancellation_cases TO authenticated';
  END IF;
END
$$;
