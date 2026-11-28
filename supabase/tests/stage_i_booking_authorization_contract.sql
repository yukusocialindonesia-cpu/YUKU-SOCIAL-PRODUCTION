-- Stage I: booking authorization contract checks for a clean, unseeded database.
-- These catalog assertions validate the customer/talent ownership boundaries
-- without requiring seeded auth.users or touching production data.
DO $$
DECLARE
  v_select_qual text;
  v_update_qual text;
  v_update_check text;
  v_messages_qual text;
  v_history_qual text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'bookings' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS is not enabled on public.bookings';
  END IF;

  SELECT qual INTO v_select_qual
  FROM pg_policies
  WHERE schemaname='public' AND tablename='bookings'
    AND policyname='bookings_select_parties_or_admin';

  IF v_select_qual IS NULL
     OR position('customer_id' in v_select_qual)=0
     OR position('talent_id' in v_select_qual)=0
     OR position('auth.uid()' in v_select_qual)=0 THEN
    RAISE EXCEPTION 'FAIL: booking SELECT policy does not bind access to customer/talent identity: %', v_select_qual;
  END IF;

  SELECT qual, with_check INTO v_update_qual, v_update_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='bookings'
    AND policyname='bookings_update_parties_or_admin';

  IF v_update_qual IS NULL OR v_update_check IS NULL
     OR position('customer_id' in v_update_qual)=0
     OR position('talent_id' in v_update_qual)=0
     OR position('customer_id' in v_update_check)=0
     OR position('talent_id' in v_update_check)=0 THEN
    RAISE EXCEPTION 'FAIL: booking UPDATE policy does not enforce ownership in USING and WITH CHECK';
  END IF;

  SELECT qual INTO v_messages_qual
  FROM pg_policies
  WHERE schemaname='public' AND tablename='booking_messages'
    AND policyname='booking_messages_select_participants';

  IF v_messages_qual IS NULL
     OR position('customer_id' in v_messages_qual)=0
     OR position('talent_id' in v_messages_qual)=0 THEN
    RAISE EXCEPTION 'FAIL: booking message reads are not limited to booking participants';
  END IF;

  SELECT qual INTO v_history_qual
  FROM pg_policies
  WHERE schemaname='public' AND tablename='booking_status_history'
    AND policyname='status_history_select_parties_or_admin';

  IF v_history_qual IS NULL
     OR position('customer_id' in v_history_qual)=0
     OR position('talent_id' in v_history_qual)=0 THEN
    RAISE EXCEPTION 'FAIL: booking status history reads are not limited to booking participants';
  END IF;

  RAISE NOTICE 'PASS: booking customer/talent authorization policy contract';
END;
$$;
