-- Minimal read RPCs; do not expose financial columns to Booking Admin.
create or replace function public.get_admin_bookings()
returns table(id uuid,booking_code varchar,customer_id uuid,talent_id uuid,booking_mode text,start_time timestamptz,
 duration_hours numeric,meeting_location_name varchar,status text,created_at timestamptz,customer_name varchar,talent_name varchar)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('booking') then raise exception 'Akses ditolak: izin Booking diperlukan.'; end if;
  return query select b.id,b.booking_code,b.customer_id,b.talent_id,b.booking_mode::text,b.start_time,b.duration_hours,
    b.meeting_location_name,b.status::text,b.created_at,cp.display_name,tp.display_name
  from public.bookings b left join public.customer_profiles cp on cp.id=b.customer_id
  left join public.talent_profiles tp on tp.id=b.talent_id order by b.created_at desc;
end;
$function$;

create or replace function public.get_admin_customer_labels(p_customer_ids uuid[])
returns table(id uuid,display_name varchar)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('finance') then raise exception 'Akses ditolak: izin Keuangan diperlukan.'; end if;
  return query select cp.id,cp.display_name from public.customer_profiles cp where cp.id=any(coalesce(p_customer_ids,array[]::uuid[]));
end;
$function$;

create or replace function public.get_admin_user_summaries(p_user_ids uuid[])
returns table(id uuid,email varchar,full_name varchar,account_status public.account_status_type,is_verified_18 boolean)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not (public.is_super_admin() or public.has_admin_permission('talent') or public.has_admin_permission('support')) then
    raise exception 'Akses ditolak: izin Talent atau Support diperlukan.';
  end if;
  return query select u.id,u.email,u.full_name,u.account_status,u.is_verified_18 from public.users u
  where u.id=any(coalesce(p_user_ids,array[]::uuid[])) and
   (public.is_super_admin() or (public.has_admin_permission('talent') and u.role='talent'::public.user_role_type)
    or (public.has_admin_permission('support') and u.role in ('customer'::public.user_role_type,'talent'::public.user_role_type)));
end;
$function$;

revoke all on function public.get_admin_bookings() from public,anon;
revoke all on function public.get_admin_customer_labels(uuid[]) from public,anon;
revoke all on function public.get_admin_user_summaries(uuid[]) from public,anon;
grant execute on function public.get_admin_bookings() to authenticated;
grant execute on function public.get_admin_customer_labels(uuid[]) to authenticated;
grant execute on function public.get_admin_user_summaries(uuid[]) to authenticated;

alter policy users_select_self_or_admin on public.users using (auth.uid()=id or public.is_super_admin());
alter policy users_update_self_or_admin on public.users using (auth.uid()=id) with check (auth.uid()=id);
alter policy customer_profiles_select on public.customer_profiles
using (auth.uid()=id or public.is_super_admin() or exists (
 select 1 from public.bookings b where b.customer_id=customer_profiles.id and b.talent_id=auth.uid()
));
alter policy customer_profiles_update on public.customer_profiles using (auth.uid()=id) with check (auth.uid()=id);
alter policy notifications_select_user on public.notifications using (auth.uid()=user_id);
alter policy bookings_select_parties_or_admin on public.bookings
using (auth.uid()=customer_id or auth.uid()=talent_id or public.is_super_admin());
alter policy bookings_update_parties_or_admin on public.bookings
using (auth.uid()=customer_id or auth.uid()=talent_id or public.is_super_admin())
with check (auth.uid()=customer_id or auth.uid()=talent_id or public.is_super_admin());
