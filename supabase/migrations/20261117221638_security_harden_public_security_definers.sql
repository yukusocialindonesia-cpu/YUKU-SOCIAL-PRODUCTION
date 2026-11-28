DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.fn);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_talent_publicly_visible(uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_talent_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.become_talent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_payment_route(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking_completion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid,text,public.booking_mode_type,timestamptz,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_network() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_customer_cancellation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_talent_cancellation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_talent_display_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_talent_service(varchar,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_talent_services(varchar[],bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_qris_payment_proof(uuid,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_talent_service(uuid,boolean,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_talent_service(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_talent_identity_change(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_payout(uuid,public.payout_status_type,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_refund(uuid,public.refund_status_type,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_customer_cancellation_case(uuid,text,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid,public.report_status_type,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_ktp(uuid,public.ktp_status_type,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_qris_payment(uuid,boolean,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_talent(uuid,boolean,public.ktp_status_type,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_qris_settings(boolean,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_admin_user(uuid) TO authenticated;
