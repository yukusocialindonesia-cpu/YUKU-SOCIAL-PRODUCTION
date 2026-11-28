GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT (booking_id, customer_id, talent_id, rating, review_text) ON public.reviews TO authenticated;
GRANT SELECT, INSERT ON public.reports_complaints TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;
GRANT SELECT ON public.talent_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.talent_availability TO authenticated;
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT INSERT (payout_number, talent_id, amount, bank_name, bank_account_number, bank_account_holder_name, payout_provider, payout_status) ON public.payout_requests TO authenticated;
GRANT SELECT ON public.talent_earnings TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.refunds TO authenticated;
GRANT INSERT (payment_id, customer_id, reason, refund_amount) ON public.refunds TO authenticated;
GRANT SELECT ON public.referral_relationships TO authenticated;
GRANT INSERT (referrer_id, referee_talent_id, referral_code_used) ON public.referral_relationships TO authenticated;
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT INSERT (ktp_verification_status) ON public.user_identities TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_meta_role TEXT;
  v_final_role public.user_role_type;
  v_display_name TEXT;
BEGIN
  v_meta_role := NEW.raw_user_meta_data ->> 'user_role';
  IF v_meta_role = 'talent' THEN
    v_final_role := 'talent'::public.user_role_type;
  ELSE
    v_final_role := 'customer'::public.user_role_type;
  END IF;

  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    split_part(NEW.email, '@', 1),
    'Pengguna YUKU'
  );

  INSERT INTO public.users (
    id, email, full_name, role, is_verified_18, account_status
  ) VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    v_final_role,
    FALSE,
    'pending_verification'::public.account_status_type
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.customer_profiles (
    id, display_name, city, gender, bio
  ) VALUES (
    NEW.id,
    v_display_name,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'city'), ''), 'Jakarta'),
    'Wanita'::public.gender_type,
    'Pengguna Komunitas YUKU'
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
