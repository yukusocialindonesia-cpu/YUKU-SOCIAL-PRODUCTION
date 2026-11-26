-- Keep profile hydration consistent with application/document review permissions.
-- Super Admin may review Professional Services even without a separate Talent grant.

drop policy if exists professional_provider_profiles_owner_read
  on public.professional_provider_profiles;

create policy professional_provider_profiles_owner_read
  on public.professional_provider_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_super_admin()
    or public.has_admin_permission('talent')
  );

comment on policy professional_provider_profiles_owner_read
  on public.professional_provider_profiles is
  'Provider reads own profile; Talent-permission admins and Super Admins can read profiles for professional-service review.';
