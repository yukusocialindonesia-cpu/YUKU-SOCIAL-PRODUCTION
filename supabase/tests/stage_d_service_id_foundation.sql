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
