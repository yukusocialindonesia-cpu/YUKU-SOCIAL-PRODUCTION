-- STAGE D: payment route lock contract checks.
-- Run only in STAGING after migration 20261127190000 is applied.
-- These checks are read-only and safe to rerun; they verify deployed SQL contracts,
-- not end-to-end booking behavior. Dynamic fixture tests remain required before release.
--
-- Expected runtime invariants to verify with disposable fixture bookings:
--   NULL -> manual_qris OR NULL -> manual_bank_transfer is allowed once;
--   Xendit/unknown routes are rejected;
--   manual_qris -> manual_bank_transfer and the reverse are rejected;
--   same-route re-claim is idempotent;
--   settle_booking_payment rejects Xendit and mismatched routes;
--   retirement migration fails closed if legacy Xendit-routed bookings exist.
-- See docs/AUDIT-AND-PAYMENT-ROUTE-LOCK-2026-11-13.md for historical context.

DO $stage_d_contract$
DECLARE
  v_constraint TEXT;
  v_claim TEXT;
  v_settle TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'public.bookings'::regclass
    AND c.conname = 'bookings_payment_route_check';

  IF v_constraint IS NULL THEN
    RAISE EXCEPTION 'STAGE D failed: bookings_payment_route_check is missing.';
  END IF;

  IF position('xendit' IN lower(v_constraint)) > 0
     OR position('manual_qris' IN lower(v_constraint)) = 0
     OR position('manual_bank_transfer' IN lower(v_constraint)) = 0 THEN
    RAISE EXCEPTION 'STAGE D failed: payment route constraint does not enforce only manual routes: %', v_constraint;
  END IF;

  SELECT pg_get_functiondef(
    'public.claim_booking_payment_route(uuid,text)'::regprocedure
  ) INTO v_claim;

  IF position('manual_qris' IN lower(v_claim)) = 0
     OR position('manual_bank_transfer' IN lower(v_claim)) = 0
     OR position('xendit' IN lower(v_claim)) > 0
     OR position('metode pembayaran tidak tersedia' IN lower(v_claim)) = 0
     OR position('for update' IN lower(v_claim)) = 0 THEN
    RAISE EXCEPTION 'STAGE D failed: payment route claim RPC is missing required allowlist/locking guards.';
  END IF;

  SELECT pg_get_functiondef(
    'public.settle_booking_payment(uuid,public.payment_provider_type,text,text,jsonb)'::regprocedure
  ) INTO v_settle;

  IF position('manual_qris' IN lower(v_settle)) = 0
     OR position('manual_bank_transfer' IN lower(v_settle)) = 0
     OR position('xendit' IN lower(v_settle)) > 0
     OR position('provider pembayaran tidak lagi didukung' IN lower(v_settle)) = 0
     OR position('for update' IN lower(v_settle)) = 0 THEN
    RAISE EXCEPTION 'STAGE D failed: settlement RPC is missing manual-provider allowlist/locking guards.';
  END IF;

  RAISE NOTICE 'STAGE D contract checks passed. Dynamic fixture tests are still required.';
END;
$stage_d_contract$;
