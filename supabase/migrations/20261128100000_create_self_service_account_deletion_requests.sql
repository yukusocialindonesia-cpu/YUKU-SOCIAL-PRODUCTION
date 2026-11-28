-- Users can submit a self-service account deletion request.
-- This table intentionally stores a minimal audit record and does not delete
-- auth users, profiles, bookings, payment records, identity evidence, or ledgers.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_snapshot text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  completed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_open_per_user
  ON public.account_deletion_requests (user_id)
  WHERE status IN ('pending', 'under_review');

CREATE INDEX IF NOT EXISTS account_deletion_requests_status_requested_idx
  ON public.account_deletion_requests (status, requested_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.account_deletion_requests TO service_role;

COMMENT ON TABLE public.account_deletion_requests IS
  'Minimal audit trail for authenticated self-service deletion requests. No account or transaction data is deleted by request submission.';
COMMENT ON COLUMN public.account_deletion_requests.user_id IS
  'Original auth user UUID retained as an audit reference; intentionally has no FK so the request survives later account removal.';
