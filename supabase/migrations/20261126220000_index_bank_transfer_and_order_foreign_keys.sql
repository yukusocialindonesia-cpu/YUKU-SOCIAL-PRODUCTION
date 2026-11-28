-- Cover foreign-key columns for the manual bank-transfer workflow.
-- The legacy application has no public.orders relation; do not create an
-- unrelated index against a table that is not part of this schema.
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
