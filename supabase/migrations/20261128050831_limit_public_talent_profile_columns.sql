-- Public profile discovery needs a bounded column set. The table also stores
-- referral_code, which should not be enumerable by anonymous catalog clients.
-- Authenticated owner/admin workflows retain their existing table-level SELECT.
REVOKE SELECT ON TABLE public.talent_profiles FROM anon;

GRANT SELECT (
  id,
  display_name,
  avatar_url,
  city,
  gender,
  headline,
  bio,
  hourly_rate,
  online_chat_rate,
  service_mode,
  rating_average,
  review_count,
  completed_hours,
  languages,
  interests,
  is_approved,
  created_at
) ON TABLE public.talent_profiles TO anon;

COMMENT ON COLUMN public.talent_profiles.referral_code IS
  'Referral identifier; intentionally excluded from anonymous public profile column grants.';
