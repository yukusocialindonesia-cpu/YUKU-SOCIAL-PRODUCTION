-- Cover foreign-key columns flagged by the Supabase performance advisor.
-- These indexes keep parent deletes/updates and future admin lookups efficient.
-- Current production tables are empty or near-empty; no data is rewritten.
CREATE INDEX IF NOT EXISTS idx_bank_transfer_audit_logs_actor_user_id
  ON public.bank_transfer_audit_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_audit_logs_booking_id
  ON public.bank_transfer_audit_logs (booking_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_audit_logs_submission_id
  ON public.bank_transfer_audit_logs (submission_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_settings_updated_by
  ON public.bank_transfer_settings (updated_by);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_submissions_admin_user_id
  ON public.bank_transfer_submissions (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_submissions_customer_id
  ON public.bank_transfer_submissions (customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);
