-- Records the indexes already applied to Production in migration
-- 20261127193455_index_uncovered_foreign_keys.
-- These indexes cover previously unindexed foreign-key columns.

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

-- Production has the legacy orders table, while the clean replay baseline
-- intentionally does not recreate that retired checkout schema. Keep this
-- historical index migration replay-safe without creating a phantom table.
DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_orders_user_id
      ON public.orders (user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_professional_service_application_status_history_actor_id
  ON public.professional_service_application_status_history (actor_id);
CREATE INDEX IF NOT EXISTS idx_professional_service_applications_reviewed_by
  ON public.professional_service_applications (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_professional_service_applications_subcategory_id
  ON public.professional_service_applications (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_professional_service_applications_verification_checked_by
  ON public.professional_service_applications (verification_checked_by);
