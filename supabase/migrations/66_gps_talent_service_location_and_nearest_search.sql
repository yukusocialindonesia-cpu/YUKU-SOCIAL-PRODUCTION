-- Secure GPS service-area storage and nearest-Talent distance RPCs.
-- Exact coordinates stay in the private schema and are never returned to Customers.

create table if not exists private.talent_service_locations (
  talent_id uuid primary key references public.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_km integer not null default 10 check (radius_km in (5, 10, 20)),
  location_label text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table private.talent_service_locations enable row level security;
revoke all on private.talent_service_locations from public, anon, authenticated;

create or replace function public.save_talent_service_location(
  p_latitude double precision, p_longitude double precision,
  p_radius_km integer default 10, p_location_label text default null,
  p_is_active boolean default true
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id=v_user_id and u.role='talent' and u.account_status='active') then
    raise exception 'Active Talent account required';
  end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;
  if p_radius_km not in (5,10,20) then raise exception 'Radius must be 5, 10, or 20 km'; end if;
  insert into private.talent_service_locations(talent_id,latitude,longitude,radius_km,location_label,is_active,updated_at)
  values(v_user_id,p_latitude,p_longitude,p_radius_km,nullif(left(trim(coalesce(p_location_label,'')),100),''),coalesce(p_is_active,false),now())
  on conflict(talent_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,
    radius_km=excluded.radius_km,location_label=excluded.location_label,is_active=excluded.is_active,updated_at=now();
  return true;
end;
$$;

create or replace function public.set_talent_location_active(p_is_active boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id=v_user_id and u.role='talent' and u.account_status='active') then
    raise exception 'Active Talent account required';
  end if;
  update private.talent_service_locations set is_active=coalesce(p_is_active,false),updated_at=now() where talent_id=v_user_id;
  if not found and coalesce(p_is_active,false) then raise exception 'Set a service location before activating GPS'; end if;
  return true;
end;
$$;

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
    join public.users u on u.id=loc.talent_id
    where auth.uid() is not null and u.account_status='active'
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

revoke all on function public.save_talent_service_location(double precision,double precision,integer,text,boolean) from public,anon;
revoke all on function public.set_talent_location_active(boolean) from public,anon;
revoke all on function public.find_nearest_talents(double precision,double precision,integer) from public,anon;
grant execute on function public.save_talent_service_location(double precision,double precision,integer,text,boolean) to authenticated;
grant execute on function public.set_talent_location_active(boolean) to authenticated;
grant execute on function public.find_nearest_talents(double precision,double precision,integer) to authenticated;
