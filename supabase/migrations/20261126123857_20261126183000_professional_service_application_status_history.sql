-- Immutable audit trail for professional-service application lifecycle changes.
create table if not exists public.professional_service_application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.professional_service_applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  admin_note text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('applicant','admin','system')),
  created_at timestamptz not null default now(),
  constraint professional_service_status_history_from_status_check
    check (from_status is null or from_status in ('pending','under_review','approved','rejected','needs_revision')),
  constraint professional_service_status_history_to_status_check
    check (to_status in ('pending','under_review','approved','rejected','needs_revision'))
);

create index if not exists idx_professional_service_status_history_application
  on public.professional_service_application_status_history(application_id, created_at asc, id asc);

alter table public.professional_service_application_status_history enable row level security;

drop policy if exists professional_service_status_history_owner_read
  on public.professional_service_application_status_history;
create policy professional_service_status_history_owner_read
  on public.professional_service_application_status_history
  for select to authenticated
  using (
    exists (
      select 1
      from public.professional_service_applications a
      where a.id = application_id
        and a.applicant_id = (select auth.uid())
    )
  );

drop policy if exists professional_service_status_history_admin_read
  on public.professional_service_application_status_history;
create policy professional_service_status_history_admin_read
  on public.professional_service_application_status_history
  for select to authenticated
  using (public.is_super_admin() or public.has_admin_permission('talent'));

revoke all on public.professional_service_application_status_history from public, anon, authenticated;
grant select on public.professional_service_application_status_history to authenticated;

create or replace function public.record_professional_service_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
begin
  if tg_op = 'INSERT' then
    v_actor_role := case
      when auth.uid() is null then 'system'
      when public.is_super_admin() or public.has_admin_permission('talent') then 'admin'
      else 'applicant'
    end;

    insert into public.professional_service_application_status_history
      (application_id, from_status, to_status, admin_note, actor_id, actor_role)
    values
      (new.id, null, new.status, new.admin_note, auth.uid(), v_actor_role);

    return new;
  end if;

  if old.status is distinct from new.status then
    v_actor_role := case
      when auth.uid() is null then 'system'
      when public.is_super_admin() or public.has_admin_permission('talent') then 'admin'
      else 'applicant'
    end;

    insert into public.professional_service_application_status_history
      (application_id, from_status, to_status, admin_note, actor_id, actor_role)
    values
      (new.id, old.status, new.status, new.admin_note, auth.uid(), v_actor_role);
  end if;

  return new;
end;
$$;

revoke all on function public.record_professional_service_application_status() from public, anon, authenticated;

drop trigger if exists trg_professional_service_application_status_history_insert
  on public.professional_service_applications;
create trigger trg_professional_service_application_status_history_insert
after insert on public.professional_service_applications
for each row execute function public.record_professional_service_application_status();

drop trigger if exists trg_professional_service_application_status_history_update
  on public.professional_service_applications;
create trigger trg_professional_service_application_status_history_update
after update of status on public.professional_service_applications
for each row
when (old.status is distinct from new.status)
execute function public.record_professional_service_application_status();

comment on table public.professional_service_application_status_history is
  'Append-only status audit trail. Applicants can read their own history; Talent-permission admins and super admins can read all history.';
