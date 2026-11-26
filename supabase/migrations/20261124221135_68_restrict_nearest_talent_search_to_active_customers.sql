-- Restrict distance lookup to active Customer accounts.
create or replace function public.find_nearest_talents(
  p_customer_latitude double precision,p_customer_longitude double precision,p_limit integer default 100
) returns table(talent_id uuid,distance_km numeric)
language sql stable security definer set search_path = ''
as $$
  with distances as (
    select loc.talent_id,loc.radius_km,
      6371.0 * 2 * atan2(
        sqrt(least(1.0,greatest(0.0,
          power(sin(radians(loc.latitude-p_customer_latitude)/2),2)
          + cos(radians(p_customer_latitude))*cos(radians(loc.latitude))
          * power(sin(radians(loc.longitude-p_customer_longitude)/2),2)
        ))),
        sqrt(1.0-least(1.0,greatest(0.0,
          power(sin(radians(loc.latitude-p_customer_latitude)/2),2)
          + cos(radians(p_customer_latitude))*cos(radians(loc.latitude))
          * power(sin(radians(loc.longitude-p_customer_longitude)/2),2)
        )))
      ) as km
    from private.talent_service_locations loc
    join public.talent_profiles tp on tp.id=loc.talent_id
    join public.users talent_user on talent_user.id=loc.talent_id
    join public.users caller on caller.id=auth.uid()
    where caller.role::text='customer' and caller.account_status::text='active'
      and talent_user.account_status::text='active'
      and tp.is_approved=true
      and tp.service_mode::text in ('Offline & Online','Offline Only')
      and loc.is_active=true
      and p_customer_latitude between -90 and 90
      and p_customer_longitude between -180 and 180
      and p_customer_latitude is not null and p_customer_longitude is not null
  )
  select d.talent_id,round(d.km::numeric,1)
  from distances d where d.km<=d.radius_km
  order by d.km asc
  limit least(greatest(coalesce(p_limit,100),1),500);
$$;
revoke all on function public.find_nearest_talents(double precision,double precision,integer) from public,anon;
grant execute on function public.find_nearest_talents(double precision,double precision,integer) to authenticated;