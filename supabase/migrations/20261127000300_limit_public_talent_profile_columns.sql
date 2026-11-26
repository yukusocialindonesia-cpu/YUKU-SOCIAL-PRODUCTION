-- Public profile discovery needs a bounded column set. The table also stores
-- referral_code, which should not be enumerable by anonymous catalog clients.
-- Authenticated owner/admin workflows retain their existing table-level SELECT.
revoke select on table public.talent_profiles from anon;

grant select (
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
) on table public.talent_profiles to anon;

comment on column public.talent_profiles.referral_code is
  'Referral identifier; intentionally excluded from anonymous public profile column grants.';
