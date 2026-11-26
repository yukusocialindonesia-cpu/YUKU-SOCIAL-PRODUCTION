-- Phase A: establish a Professional Services identity independent of Companion/Talent.
-- Additive only: existing provider_id FKs and current application/public flows remain
-- unchanged until later compatibility migrations switch every consumer.

create table if not exists public.professional_provider_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name varchar(100) not null,
  avatar_url text,
  city varchar(100),
  headline varchar(200),
  bio text,
  is_profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.professional_provider_profiles is
  'Independent Professional Services public identity. A row does not create or imply a Companion/Talent profile or listing.';

create index if not exists idx_professional_provider_profiles_city
  on public.professional_provider_profiles(city);

-- Backfill existing professional applicants/listing owners. Reuse the existing
-- account UUID and copy only public presentation fields; never copy legal identity
-- or private verification documents into this profile.
insert into public.professional_provider_profiles (
  user_id, display_name, avatar_url, city, headline, bio, is_profile_complete
)
select
  source.user_id,
  coalesce(nullif(tp.display_name, ''), nullif(u.full_name, ''), 'Penyedia Profesional'),
  tp.avatar_url,
  tp.city,
  tp.headline,
  tp.bio,
  (tp.id is not null)
from (
  select applicant_id as user_id
    from public.professional_service_applications
  union
  select provider_id as user_id
    from public.professional_talent_services
) source
join public.users u on u.id = source.user_id
left join public.talent_profiles tp on tp.id = source.user_id
on conflict (user_id) do nothing;

alter table public.professional_provider_profiles enable row level security;

drop policy if exists professional_provider_profiles_owner_read
  on public.professional_provider_profiles;
create policy professional_provider_profiles_owner_read
  on public.professional_provider_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_admin_permission('talent')
  );

drop policy if exists professional_provider_profiles_owner_insert
  on public.professional_provider_profiles;
create policy professional_provider_profiles_owner_insert
  on public.professional_provider_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists professional_provider_profiles_owner_update
  on public.professional_provider_profiles;
create policy professional_provider_profiles_owner_update
  on public.professional_provider_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Public presentation is visible only when the account already has at least
-- one approved, active professional listing. The listing's own public RLS and
-- publication guard remain responsible for account-status eligibility.
-- This does not grant visibility to draft or applicant-only profiles.
drop policy if exists professional_provider_profiles_public_read
  on public.professional_provider_profiles;
create policy professional_provider_profiles_public_read
  on public.professional_provider_profiles
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.professional_talent_services pts
      where pts.provider_id = professional_provider_profiles.user_id
        and pts.approval_status = 'approved'
        and pts.is_active = true
    )
  );

grant select on public.professional_provider_profiles to anon, authenticated;
grant insert (user_id, display_name, avatar_url, city, headline, bio, is_profile_complete)
  on public.professional_provider_profiles to authenticated;
grant update (display_name, avatar_url, city, headline, bio, is_profile_complete, updated_at)
  on public.professional_provider_profiles to authenticated;
