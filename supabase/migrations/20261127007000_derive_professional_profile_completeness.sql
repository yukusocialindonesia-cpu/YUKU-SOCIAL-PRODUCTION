-- Phase E hardening: profile completeness is derived by the database.
-- Client-supplied is_profile_complete must never be trusted for publication.

create or replace function public.set_professional_provider_profile_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.is_profile_complete :=
    length(trim(coalesce(new.display_name, ''))) >= 2
    and length(trim(coalesce(new.city, ''))) >= 2
    and length(trim(coalesce(new.headline, ''))) >= 3
    and length(trim(coalesce(new.bio, ''))) >= 20;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_professional_provider_profile_completeness()
  from public, anon, authenticated;

drop trigger if exists trg_professional_provider_profile_completeness
  on public.professional_provider_profiles;

create trigger trg_professional_provider_profile_completeness
before insert or update of display_name, city, headline, bio, is_profile_complete
on public.professional_provider_profiles
for each row
execute function public.set_professional_provider_profile_completeness();

-- Recalculate historical/backfilled rows using the same server-side rule.
update public.professional_provider_profiles
set is_profile_complete = (
  length(trim(coalesce(display_name, ''))) >= 2
  and length(trim(coalesce(city, ''))) >= 2
  and length(trim(coalesce(headline, ''))) >= 3
  and length(trim(coalesce(bio, ''))) >= 20
);
