-- Replay-safe prerequisite for professional listings.
-- The original hardening migration 25 uses a legacy filename and is skipped
-- by timestamp-only clean replay. Restore the Talent approval flag before
-- professional listing policies and review RPCs reference it.
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.talent_profiles tp
SET is_approved = TRUE
FROM public.users u, public.user_identities ui
WHERE tp.is_approved = FALSE
  AND u.id = tp.id
  AND ui.id = tp.id
  AND u.account_status = 'active'::public.account_status_type
  AND u.is_verified_18 IS TRUE
  AND ui.ktp_verification_status = 'verified'::public.ktp_status_type;

CREATE INDEX IF NOT EXISTS idx_talent_profiles_is_approved
  ON public.talent_profiles(is_approved) WHERE is_approved;
