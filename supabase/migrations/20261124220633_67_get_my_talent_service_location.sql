create or replace function public.get_my_talent_service_location()
returns table(latitude double precision, longitude double precision, radius_km integer, location_label text, is_active boolean)
language sql stable security definer set search_path = ''
as $$
  select loc.latitude, loc.longitude, loc.radius_km, loc.location_label, loc.is_active
  from private.talent_service_locations loc
  join public.users u on u.id=loc.talent_id
  where loc.talent_id=auth.uid() and u.role='talent' and u.account_status='active'
  limit 1;
$$;
revoke all on function public.get_my_talent_service_location() from public,anon;
grant execute on function public.get_my_talent_service_location() to authenticated;
