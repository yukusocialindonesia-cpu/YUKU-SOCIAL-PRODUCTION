-- Stage D: Social Experience exact service ID foundation contract checks.
-- Run after migration 40 in a disposable/staging database.
DO $$
DECLARE
  v_service_id_attnum SMALLINT;
BEGIN
  SELECT attnum INTO v_service_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.bookings'::regclass
    AND attname = 'service_id'
    AND NOT attisdropped;

  IF v_service_id_attnum IS NULL THEN
    RAISE EXCEPTION 'bookings.service_id is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.bookings'::regclass
      AND attname = 'service_id'
      AND NOT attisdropped
      AND attnotnull
  ) THEN
    RAISE EXCEPTION 'bookings.service_id must remain nullable for legacy history';
  END IF;

  IF to_regprocedure('public.create_booking_for_service(uuid,public.booking_mode_type,timestamp with time zone,numeric,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Exact service booking RPC is missing';
  END IF;

  IF to_regprocedure('public.create_booking(uuid,text,public.booking_mode_type,timestamp with time zone,numeric,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Legacy booking RPC signature must remain available';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bookings'::regclass
      AND tgname = 'trg_assign_booking_service_snapshot'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Service identity snapshot trigger is missing';
  END IF;

  IF position('set_config' IN pg_get_functiondef(to_regprocedure('public.create_booking_for_service(uuid,public.booking_mode_type,timestamp with time zone,numeric,text,text)'))) = 0 THEN
    RAISE EXCEPTION 'Exact service ID is not propagated to the booking insert trigger';
  END IF;

  IF position('current_setting' IN pg_get_functiondef('public.assign_booking_service_snapshot()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Booking insert trigger does not consume the exact service ID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger assign_trigger
    JOIN pg_trigger financial_trigger
      ON financial_trigger.tgrelid = assign_trigger.tgrelid
    WHERE assign_trigger.tgrelid = 'public.bookings'::regclass
      AND assign_trigger.tgname = 'trg_assign_booking_service_snapshot'
      AND financial_trigger.tgname = 'trg_calculate_booking_financials'
      AND assign_trigger.tgname < financial_trigger.tgname
      AND NOT assign_trigger.tgisinternal
      AND NOT financial_trigger.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Service identity trigger must run before financial snapshot trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.talent_services'::regclass
      AND conname = 'uq_talent_activity'
  ) THEN
    RAISE EXCEPTION 'Do not enable multi-offer-per-category before end-to-end exact ID rollout';
  END IF;

  IF has_function_privilege('anon',
    'public.create_booking_for_service(uuid,public.booking_mode_type,timestamp with time zone,numeric,text,text)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role must not execute exact service booking RPC';
  END IF;

  IF NOT has_function_privilege('authenticated',
    'public.create_booking_for_service(uuid,public.booking_mode_type,timestamp with time zone,numeric,text,text)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role must be able to execute exact service booking RPC';
  END IF;
END;
$$;


-- Stage D.2: financial-consumer contract checks.
-- These are catalog/source-contract checks, not substitutes for runtime
-- concurrency and provider-callback tests in a disposable staging database.
DO $$
DECLARE
  v_validate_update TEXT;
  v_ledger_function TEXT;
  v_refund_function TEXT;
BEGIN
  -- The booking's money snapshots must remain protected by the existing
  -- booking update guard; service identity has its own dedicated guard above.
  IF to_regprocedure('public.validate_booking_update()') IS NULL THEN
    RAISE EXCEPTION 'Booking financial snapshot update guard is missing';
  END IF;

  v_validate_update := pg_get_functiondef('public.validate_booking_update()'::regprocedure);
  IF position('gross_amount' IN v_validate_update) = 0
     OR position('platform_fee_amount' IN v_validate_update) = 0
     OR position('talent_gross_share' IN v_validate_update) = 0
     OR position('hourly_rate_snapshot' IN v_validate_update) = 0 THEN
    RAISE EXCEPTION 'Booking financial snapshot fields are not protected by validate_booking_update()';
  END IF;

  -- Settlement must create financial ledgers from the frozen booking values,
  -- and the payment trigger/function must retain booking-keyed idempotency.
  IF to_regprocedure('public.auto_generate_booking_financial_ledgers()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.payments'::regclass
         AND tgname = 'trg_auto_generate_booking_financial_ledgers'
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Payment settlement ledger trigger/function is missing';
  END IF;

  v_ledger_function := pg_get_functiondef(
    'public.auto_generate_booking_financial_ledgers()'::regprocedure
  );
  IF position('gross_amount' IN v_ledger_function) = 0
     OR position('platform_fee_amount' IN v_ledger_function) = 0
     OR position('talent_gross_share' IN v_ledger_function) = 0
     OR position('ON CONFLICT (booking_id) DO NOTHING' IN v_ledger_function) = 0 THEN
    RAISE EXCEPTION 'Settlement ledger must use frozen booking amounts and booking-keyed idempotency';
  END IF;

  -- Refund/cancellation reversals are booking-linked and must remain guarded
  -- against duplicate reversal rows. This does NOT prove proportional partial
  -- refund allocation; that remains a separate finance-policy requirement.
  IF to_regprocedure('public.handle_booking_refund_financials()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.bookings'::regclass
         AND tgname = 'trg_handle_booking_refund_financials'
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Booking refund financial handler/trigger is missing';
  END IF;

  v_refund_function := pg_get_functiondef(
    'public.handle_booking_refund_financials()'::regprocedure
  );
  IF position('financial_adjustments_reversals' IN v_refund_function) = 0
     OR position('booking_id' IN v_refund_function) = 0 THEN
    RAISE EXCEPTION 'Refund financial handler no longer uses booking-linked reversal records';
  END IF;

  -- Payout completion must still be blocked when an allocated earning is
  -- disputed. Do not remove this safeguard during service-ID rollout.
  IF to_regprocedure('public.guard_payout_completion_during_dispute()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.payout_requests'::regclass
         AND tgname = 'trg_guard_payout_completion_during_dispute'
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Payout dispute guard is missing';
  END IF;
END;
$$;
