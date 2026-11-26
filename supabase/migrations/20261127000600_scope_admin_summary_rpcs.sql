-- Restrict SECURITY DEFINER Admin summary RPCs to records the caller's module may review.
-- Talent summaries are limited to actual Talent profiles.
-- Support summaries are limited to Customer KTP records or users named in reports.
-- Report booking summaries are limited to bookings attached to reports.

create or replace function public.get_admin_user_summaries(p_user_ids uuid[])
returns table(
  id uuid,
  email varchar,
  full_name varchar,
  account_status public.account_status_type,
  is_verified_18 boolean,
  role public.user_role_type
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not (
    public.is_super_admin()
    or public.has_admin_permission('talent')
    or public.has_admin_permission('support')
  ) then
    raise exception 'Akses ditolak: izin Talent atau Support diperlukan.';
  end if;

  return query
  select u.id, u.email, u.full_name, u.account_status, u.is_verified_18, u.role
  from public.users u
  where u.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and (
      public.is_super_admin()
      or (
        public.has_admin_permission('talent')
        and u.role = 'talent'::public.user_role_type
        and exists (
          select 1 from public.talent_profiles tp where tp.id = u.id
        )
      )
      or (
        public.has_admin_permission('support')
        and u.role in ('customer'::public.user_role_type, 'talent'::public.user_role_type)
        and (
          (
            u.role = 'customer'::public.user_role_type
            and exists (
              select 1 from public.user_identities ui where ui.id = u.id
            )
          )
          or exists (
            select 1
            from public.reports_complaints r
            where r.reporter_id = u.id or r.reported_user_id = u.id
          )
        )
      )
    );
end;
$function$;

create or replace function public.get_admin_report_booking_summaries(p_booking_ids uuid[])
returns table(id uuid, booking_code varchar, status text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('support') then
    raise exception 'Akses ditolak: izin Support diperlukan.';
  end if;

  return query
  select b.id, b.booking_code, b.status::text
  from public.bookings b
  where b.id = any(coalesce(p_booking_ids, array[]::uuid[]))
    and exists (
      select 1 from public.reports_complaints r where r.booking_id = b.id
    );
end;
$function$;

revoke all on function public.get_admin_user_summaries(uuid[]) from public, anon;
revoke all on function public.get_admin_report_booking_summaries(uuid[]) from public, anon;
grant execute on function public.get_admin_user_summaries(uuid[]) to authenticated;
grant execute on function public.get_admin_report_booking_summaries(uuid[]) to authenticated;


create or replace function public.get_admin_talent_labels(p_talent_ids uuid[])
returns table(id uuid, display_name varchar, city varchar)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('finance') then
    raise exception 'Akses ditolak: izin Keuangan diperlukan.';
  end if;

  return query
  select tp.id, tp.display_name, tp.city
  from public.talent_profiles tp
  where tp.id = any(coalesce(p_talent_ids, array[]::uuid[]))
    and exists (
      select 1 from public.payout_requests pr where pr.talent_id = tp.id
    );
end;
$function$;

create or replace function public.get_admin_customer_labels(p_customer_ids uuid[])
returns table(id uuid, display_name varchar)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('finance') then
    raise exception 'Akses ditolak: izin Keuangan diperlukan.';
  end if;

  return query
  select cp.id, cp.display_name
  from public.customer_profiles cp
  where cp.id = any(coalesce(p_customer_ids, array[]::uuid[]))
    and (
      exists (select 1 from public.refunds rf where rf.customer_id = cp.id)
      or exists (select 1 from public.customer_cancellation_cases cc where cc.customer_id = cp.id)
    );
end;
$function$;

create or replace function public.get_admin_finance_booking_labels(p_booking_ids uuid[])
returns table(id uuid, booking_code varchar)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('finance') then
    raise exception 'Akses ditolak: izin Keuangan diperlukan.';
  end if;

  return query
  select b.id, b.booking_code
  from public.bookings b
  where b.id = any(coalesce(p_booking_ids, array[]::uuid[]))
    and (
      exists (select 1 from public.refunds rf where rf.booking_id = b.id)
      or exists (select 1 from public.customer_cancellation_cases cc where cc.booking_id = b.id)
    );
end;
$function$;

revoke all on function public.get_admin_talent_labels(uuid[]) from public, anon;
revoke all on function public.get_admin_customer_labels(uuid[]) from public, anon;
revoke all on function public.get_admin_finance_booking_labels(uuid[]) from public, anon;
grant execute on function public.get_admin_talent_labels(uuid[]) to authenticated;
grant execute on function public.get_admin_customer_labels(uuid[]) to authenticated;
grant execute on function public.get_admin_finance_booking_labels(uuid[]) to authenticated;
