-- Close direct client-side INSERT access to payout_requests.
-- Talent payout requests must go through request_talent_payout(), which
-- validates account eligibility, identity verification, bank details,
-- minimum amount, available balance, and idempotency.
--
-- The SECURITY DEFINER RPC is owned by postgres and its EXECUTE privilege
-- is already limited to authenticated (verified against Production ACL).
-- Admin/Finance processing and database triggers remain unchanged.

DROP POLICY IF EXISTS payout_requests_insert_talent
  ON public.payout_requests;

-- Revoke table-level INSERT and the legacy column-level INSERT grant.
-- Column-level grants must be revoked explicitly; revoking only table-level
-- INSERT would not remove the permissions granted by migration 08.
REVOKE INSERT ON TABLE public.payout_requests
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT (
  payout_number,
  talent_id,
  amount,
  bank_name,
  bank_account_number,
  bank_account_holder_name,
  payout_provider,
  payout_status
) ON TABLE public.payout_requests
  FROM PUBLIC, anon, authenticated;
