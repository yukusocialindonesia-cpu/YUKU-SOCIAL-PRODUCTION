create or replace function public.get_admin_finance_booking_labels(p_booking_ids uuid[])
returns table(id uuid,booking_code varchar)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.has_admin_permission('finance') then
    raise exception 'Akses ditolak: izin Keuangan diperlukan.';
  end if;
  return query select b.id,b.booking_code from public.bookings b
  where b.id=any(coalesce(p_booking_ids,array[]::uuid[]));
end;
$function$;
revoke all on function public.get_admin_finance_booking_labels(uuid[]) from public,anon;
grant execute on function public.get_admin_finance_booking_labels(uuid[]) to authenticated;
