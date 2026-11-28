-- YUKU Production: configurable one-tier Talent affiliate commission.
-- Existing reward rows are preserved; the new rate applies only to future settled payments.
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id IS TRUE),
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (commission_percent >= 0 AND commission_percent <= 100),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
);

INSERT INTO public.affiliate_settings (id, commission_percent, is_enabled)
VALUES (TRUE, 10.00, TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliate_settings_admin_select ON public.affiliate_settings;
CREATE POLICY affiliate_settings_admin_select
  ON public.affiliate_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS affiliate_settings_admin_update ON public.affiliate_settings;
CREATE POLICY affiliate_settings_admin_update
  ON public.affiliate_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, UPDATE ON public.affiliate_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_generate_booking_financial_ledgers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_referral_rel public.referral_relationships%ROWTYPE;
  v_has_referral BOOLEAN := FALSE;
  v_referral_reward_amount BIGINT := 0;
  v_referral_percent NUMERIC(5,2) := 10.00;
  v_referral_enabled BOOLEAN := TRUE;
BEGIN
  IF NEW.payment_status <> 'settled_held'::public.payment_status_type THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.payment_status = 'settled_held'::public.payment_status_type THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking untuk pembayaran tidak ditemukan.';
  END IF;

  SELECT * INTO v_referral_rel
  FROM public.referral_relationships
  WHERE referee_talent_id = v_booking.talent_id
    AND is_active IS TRUE
  ORDER BY created_at ASC
  LIMIT 1;
  v_has_referral := FOUND;

  SELECT commission_percent, is_enabled
  INTO v_referral_percent, v_referral_enabled
  FROM public.affiliate_settings
  WHERE id IS TRUE;

  v_referral_percent := COALESCE(v_referral_percent, 10.00);
  v_referral_enabled := COALESCE(v_referral_enabled, TRUE);

  IF v_has_referral AND v_referral_enabled AND v_referral_percent > 0 THEN
    v_referral_reward_amount := ROUND(
      v_booking.platform_fee_amount::NUMERIC * v_referral_percent / 100
    )::BIGINT;
  END IF;

  INSERT INTO public.commission_records (
    booking_id, gross_booking_amount, platform_commission_amount,
    talent_gross_share, referral_payout_reserved, net_platform_revenue
  ) VALUES (
    v_booking.id, v_booking.gross_amount, v_booking.platform_fee_amount,
    v_booking.talent_gross_share, v_referral_reward_amount,
    v_booking.platform_fee_amount - v_referral_reward_amount
  ) ON CONFLICT (booking_id) DO NOTHING;

  INSERT INTO public.talent_earnings (
    talent_id, booking_id, gross_earning, tax_withheld, transfer_fee,
    net_earning, status, entry_type
  ) VALUES (
    v_booking.talent_id, v_booking.id, v_booking.talent_gross_share, 0, 0,
    v_booking.talent_gross_share,
    'held_in_escrow'::public.talent_earning_status_type,
    'earning'::public.ledger_entry_type
  ) ON CONFLICT (booking_id) DO NOTHING;

  IF v_has_referral AND v_referral_reward_amount > 0 THEN
    INSERT INTO public.referral_rewards (
      referral_relationship_id, booking_id, referrer_id,
      platform_commission_base, reward_amount, status
    ) VALUES (
      v_referral_rel.id, v_booking.id, v_referral_rel.referrer_id,
      v_booking.platform_fee_amount, v_referral_reward_amount,
      'pending_completion'::public.referral_reward_status_type
    ) ON CONFLICT (booking_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.affiliate_settings IS
'Pengaturan program Affiliate Talent satu tingkat. Persentase hanya diterapkan pada transaksi baru yang pembayarannya berhasil.';
COMMENT ON FUNCTION public.auto_generate_booking_financial_ledgers() IS
'Creates financial ledgers idempotently and calculates one-tier Talent affiliate reward using the current affiliate_settings rate for newly settled payments.';

