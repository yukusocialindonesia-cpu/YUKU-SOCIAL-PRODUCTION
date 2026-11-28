-- Stage I: Multi-profile Customer booking authorization contract.
-- Run only in a disposable/staging database after the matching migration.
-- This is a catalog contract check; it does not replace JWT-backed runtime tests.
DO $$
DECLARE
  v_definition text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.create_booking(uuid,text,public.booking_mode_type,timestamp with time zone,numeric,text,text)'::regprocedure
  );

  IF position('public.customer_profiles' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Booking actor must be authorized through customer_profiles';
  END IF;
  IF position('v_customer.role' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'Legacy primary users.role must not gate Customer booking';
  END IF;
  IF position('v_customer.account_status' IN v_definition) = 0
     OR position('v_customer.is_verified_18' IN v_definition) = 0
     OR position('user_identities' IN v_definition) = 0
     OR position('ktp_verification_status' IN v_definition) = 0
     OR position('is_talent_publicly_visible' IN v_definition) = 0
     OR position('Self booking is not allowed' IN v_definition) = 0
     OR position('payment_checkout' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A required booking eligibility or payment guard was lost';
  END IF;
  IF position('SECURITY DEFINER' IN v_definition) = 0
     OR position('search_path TO ''''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Booking RPC security execution settings changed unexpectedly';
  END IF;
END;
$$;
