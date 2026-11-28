-- Index Affiliate foreign keys and Talent balance lookups.
CREATE INDEX IF NOT EXISTS idx_affiliate_settings_updated_by
  ON public.affiliate_settings (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_talent_affiliate_earnings_talent_status_available
  ON public.talent_affiliate_earnings (talent_id, status, available_at);

CREATE INDEX IF NOT EXISTS idx_payout_allocations_affiliate_earning
  ON public.payout_earnings_allocations (affiliate_earning_id)
  WHERE affiliate_earning_id IS NOT NULL;

