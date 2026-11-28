-- Keep public Talent discovery independent from authenticated admin helpers.
-- The anonymous policy can evaluate only the public-visibility predicate.
-- Authenticated owners and Talent Admins retain their scoped access.
drop policy if exists talent_profiles_select_public on public.talent_profiles;
drop policy if exists talent_profiles_select_public_anon on public.talent_profiles;
drop policy if exists talent_profiles_select_authenticated on public.talent_profiles;

create policy talent_profiles_select_public_anon
  on public.talent_profiles
  for select
  to anon
  using (public.is_talent_publicly_visible(id));

create policy talent_profiles_select_authenticated
  on public.talent_profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.has_admin_permission('talent')
    or public.is_talent_publicly_visible(id)
  );
