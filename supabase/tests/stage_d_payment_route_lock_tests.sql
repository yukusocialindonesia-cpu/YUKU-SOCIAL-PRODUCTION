-- STAGE D: payment route lock contract checks.
-- Run only in isolated STAGING after migration 20261127190000 is applied.
-- This validates SQL definitions, not full booking runtime behavior.
-- Dynamic fixture tests remain required before release.

DO $stage_d_contract$
DECLARE
  v_constraint TEXT;
  v_claim TEXT;
  v_settle TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'public.bookings'::regclass
    AND c.conname = 'bookings_payment_route_check';

  IF v_constraint IS NULL
     OR position('xendit' IN lower(v_constraint)) > 0
     OR position('manual_qris' IN lower(v_constraint)) = 0
     OR position('manual_bank_transfer' IN lower(v_constraint)) = 0 THEN
    RAISE EXCEPTION 'STAGE D failed: payment route constraint is missing or still permits a retired route: %', v_constraint;
  END IF;

  SELECT pg_get_functiondef('public.claim_booking_payment_route(uuid,text)'::regprocedure)
    INTO v_claim;
  IF position('xendit' IN lower(v_claim)) > 0
     OR position('manual_qris' IN lower(v_claim)) = 0
     OR position('manual_bank_transfer' IN lower(v_claim)) = 0
     OR position('for update' IN lower(v_claim)) = 0 THEN
    RAISE EXCEPTION 'STAGE D failed: route claim RPC does not enforce the manual route allowlist and row lock.';
  END IF;

  SELECT pg_get_functiondef('public.settle_booking_payment(uuid,public.payment_provider_type,text,text,jsonb)'::regprocedure)
    INTO v_settle;
  IF position('xendit' IN lower(v_settle)) > 0
     OR position('manual_qris' IN lower(v_settle)) = 0
     OR position('manual_bank_transfer' IN lower(v_settle)) = 0
     OR position('for update' IN lower(v_settle)) = 0 THEN
    RAISE EXCEPTION 'STAGE D failed: settlement RPC does not enforce the manual provider allowlist and row lock.';
  END IF;

  RAISE NOTICE 'STAGE D contract checks passed. Dynamic fixture tests are still required.';
END;
$stage_d_contract$;
