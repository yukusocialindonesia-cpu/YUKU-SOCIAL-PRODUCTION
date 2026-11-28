create or replace function public.get_admin_finance_booking_statuses(p_booking_ids uuid[])
returns table(id uuid,status text)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('finance') then
    raise exception 'Akses ditolak: izin Keuangan diperlukan.';
  end if;
  return query select b.id,b.status::text from public.bookings b
  where b.id=any(coalesce(p_booking_ids,array[]::uuid[]));
end;
$function$;
revoke all on function public.get_admin_finance_booking_statuses(uuid[]) from public,anon;
grant execute on function public.get_admin_finance_booking_statuses(uuid[]) to authenticated;

