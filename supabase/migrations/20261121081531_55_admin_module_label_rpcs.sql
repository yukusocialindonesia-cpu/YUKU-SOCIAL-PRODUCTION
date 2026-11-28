create or replace function public.get_admin_talent_labels(p_talent_ids uuid[])
returns table(id uuid,display_name varchar,city varchar)
language plpgsql stable security definer set search_path to ''
as $function$
begin
 if auth.uid() is null or not public.has_admin_permission('finance') then raise exception 'Akses ditolak: izin Keuangan diperlukan.'; end if;
 return query select tp.id,tp.display_name,tp.city from public.talent_profiles tp where tp.id=any(coalesce(p_talent_ids,array[]::uuid[]));
end;
$function$;

create or replace function public.get_admin_report_booking_summaries(p_booking_ids uuid[])
returns table(id uuid,booking_code varchar,status text)
language plpgsql stable security definer set search_path to ''
as $function$
begin
 if auth.uid() is null or not public.has_admin_permission('support') then raise exception 'Akses ditolak: izin Support diperlukan.'; end if;
 return query select b.id,b.booking_code,b.status::text from public.bookings b where b.id=any(coalesce(p_booking_ids,array[]::uuid[]));
end;
$function$;

revoke all on function public.get_admin_talent_labels(uuid[]) from public,anon;
revoke all on function public.get_admin_report_booking_summaries(uuid[]) from public,anon;
grant execute on function public.get_admin_talent_labels(uuid[]) to authenticated;
grant execute on function public.get_admin_report_booking_summaries(uuid[]) to authenticated;
alter policy activity_categories_select_public on public.activity_categories
using (is_active or public.is_super_admin() or public.has_admin_permission('talent'));

