-- Close the direct client INSERT path for payout requests.
-- All Talent payout requests must go through request_talent_payout(), which
-- validates active Talent status, age/KTP verification, profile approval,
-- minimum amount, bank details, idempotency, and balance allocation.

REVOKE INSERT ON TABLE public.payout_requests FROM authenticated;

-- Column-level grants are independent of table-level grants in PostgreSQL.
-- Revoke the legacy grant explicitly as defense in depth.
REVOKE INSERT (
  payout_number,
  talent_id,
  amount,
  bank_name,
  bank_account_number,
  bank_account_holder_name,
  payout_provider,
  payout_status
) ON TABLE public.payout_requests FROM authenticated;

DROP POLICY IF EXISTS "payout_requests_insert_talent" ON public.payout_requests;

-- Keep the supported RPC as the sole authenticated request entry point.
REVOKE ALL ON FUNCTION public.request_talent_payout(BIGINT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_talent_payout(BIGINT, TEXT, TEXT, TEXT, UUID)
  TO authenticated;

COMMENT ON FUNCTION public.request_talent_payout(BIGINT, TEXT, TEXT, TEXT, UUID) IS
  'Sole authenticated entry point for Talent payout requests; validates eligibility, idempotency and balance allocation.';
