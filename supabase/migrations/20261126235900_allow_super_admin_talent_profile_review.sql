-- The professional-services Admin page must be able to inspect the Talent profile
-- for an application even when that profile is not yet publicly visible.
-- This grants read access only to authenticated Super Admins; it does not publish profiles.

drop policy if exists talent_profiles_super_admin_review_read
  on public.talent_profiles;
create policy talent_profiles_super_admin_review_read
  on public.talent_profiles
  for select to authenticated
  using (public.is_super_admin());

comment on policy talent_profiles_super_admin_review_read
  on public.talent_profiles is
  'Allows authenticated Super Admins to inspect Talent profile details while reviewing private professional-service applications.';
