-- Records the RLS auth.uid() initplan optimization already applied
-- and verified in Supabase Production. Access predicates are unchanged;
-- auth.uid() is evaluated once per statement rather than per row.

DO $$
DECLARE r record; stmt text;
BEGIN
  FOR r IN
    SELECT p.*
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p.tablename, p.policyname) IN (VALUES ('user_identities','user_identities_owner_or_admin_update'),('bank_transfer_submissions','bank_transfer_submissions_read_owner_or_finance'),('customer_profiles','customer_profiles_update'),('bookings','bookings_update_parties_or_admin'),('qris_payment_submissions','qris_submissions_read_owner_or_finance'),('referral_rewards','referral_rewards_select_referrer_or_admin'),('user_identities','user_identities_owner_or_admin_select'),('users','users_select_self_or_admin'),('users','users_update_self_or_admin'),('customer_profiles','customer_profiles_select'),('talent_profiles','talent_profiles_update_self_or_admin'),('reports_complaints','reports_select_reporter_or_admin'),('bookings','bookings_select_parties_or_admin'),('payments','payments_select_parties_or_admin'),('booking_status_history','status_history_select_parties_or_admin'),('payout_earnings_allocations','payout_earnings_alloc_talent_or_admin'),('notifications','notifications_select_user'),('talent_media','talent_media_select_public_or_owner'),('talent_media','talent_media_owner_or_admin_delete'),('booking_messages','booking_messages_select_participants'),('talent_identity_change_requests','talent_identity_requests_owner_read'),('talent_service_change_log','talent_service_change_log_owner_read'),('talent_services','talent_services_select_scoped'),('talent_availability','talent_availability_owner_insert'),('bank_transfer_payment_instructions','bank_transfer_instructions_read_owner_or_finance'),('talent_profiles','talent_profiles_select_public'),('talent_availability','talent_availability_owner_delete'),('talent_availability','talent_availability_owner_update'),('payout_requests','payout_requests_select_talent_or_admin'),('talent_earnings','talent_earnings_select_talent_or_admin'),('talent_affiliate_earnings','talent_affiliate_earnings_select_talent_or_admin'),('refunds','refunds_select_customer_or_admin'),('customer_cancellation_cases','customer_cancellation_case_customer_or_admin_select'),('referral_relationships','referral_relationships_select_parties'))
  LOOP
    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF r.qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', replace(r.qual, 'auth.uid()', '(SELECT auth.uid())'));
    END IF;
    IF r.with_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', replace(r.with_check, 'auth.uid()', '(SELECT auth.uid())'));
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
