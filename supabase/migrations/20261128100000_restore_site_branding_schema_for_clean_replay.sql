-- Restore the site-branding schema required by the Admin panel and migration 49.
-- Idempotent for clean local replay and environments where the objects already exist.
-- This migration is intentionally scoped to the existing public logo/icon feature.

create table if not exists public.site_branding (
  id boolean primary key default true check (id = true),
  logo_path text,
  icon_path text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_branding enable row level security;

grant select on public.site_branding to anon, authenticated;
grant insert, update on public.site_branding to authenticated;

drop policy if exists site_branding_select_public on public.site_branding;
create policy site_branding_select_public
  on public.site_branding
  for select
  to anon, authenticated
  using (true);

drop policy if exists site_branding_admin_insert on public.site_branding;
create policy site_branding_admin_insert
  on public.site_branding
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists site_branding_admin_update on public.site_branding;
create policy site_branding_admin_update
  on public.site_branding
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists branding_admin_select on storage.objects;
create policy branding_admin_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()));

drop policy if exists branding_admin_insert on storage.objects;
create policy branding_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'branding' and (select public.is_admin()));

drop policy if exists branding_admin_update on storage.objects;
create policy branding_admin_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()))
  with check (bucket_id = 'branding' and (select public.is_admin()));

drop policy if exists branding_admin_delete on storage.objects;
create policy branding_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()));
