-- YUKU Merchant Partner foundation.
-- Additive only: separate business identities and memberships from Talent/Professional profiles.
-- This migration is a draft in the feature branch; do not apply to Production without staging review.

begin;

create table if not exists public.merchant_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  business_name text not null check (char_length(trim(business_name)) between 2 and 120),
  description text null check (description is null or char_length(description) <= 2000),
  business_category text null check (business_category is null or char_length(business_category) <= 80),
  public_phone text null check (public_phone is null or char_length(public_phone) <= 40),
  website_url text null check (website_url is null or char_length(website_url) <= 500),
  review_status text not null default 'pending_review'
    check (review_status in ('draft','pending_review','needs_revision','approved','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.merchant_businesses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  member_role text not null check (member_role in ('owner','manager','staff')),
  membership_status text not null default 'active'
    check (membership_status in ('pending_invitation','active','suspended','revoked')),
  invited_by uuid null references public.users(id) on delete set null,
  invited_at timestamptz null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  constraint merchant_membership_owner_active_check
    check (member_role <> 'owner' or membership_status = 'active')
);

create unique index if not exists merchant_one_owner_per_business
  on public.merchant_memberships (business_id)
  where member_role = 'owner' and membership_status = 'active';

create index if not exists merchant_memberships_user_status_idx
  on public.merchant_memberships (user_id, membership_status, business_id);

create table if not exists public.merchant_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.merchant_businesses(id) on delete cascade,
  location_name text not null check (char_length(trim(location_name)) between 2 and 120),
  address_text text not null check (char_length(trim(address_text)) between 5 and 500),
  city text null check (city is null or char_length(city) <= 100),
  province text null check (province is null or char_length(province) <= 100),
  country_code char(2) not null default 'ID',
  public_phone text null check (public_phone is null or char_length(public_phone) <= 40),
  opening_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(opening_hours) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_locations_business_active_idx
  on public.merchant_locations (business_id, is_active);

alter table public.merchant_businesses enable row level security;
alter table public.merchant_memberships enable row level security;
alter table public.merchant_locations enable row level security;

-- Boolean-only membership helper used by RLS. It exposes no membership data.
create or replace function private.has_merchant_business_access(
  p_business_id uuid,
  p_allowed_roles text[] default array['owner','manager','staff']::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.users u
       where u.id = auth.uid()
         and u.account_status = 'active'::public.account_status_type
    )
    and exists (
      select 1
        from public.merchant_memberships mm
       where mm.business_id = p_business_id
         and mm.user_id = auth.uid()
         and mm.membership_status = 'active'
         and mm.member_role = any(p_allowed_roles)
    );
$$;

revoke all on function private.has_merchant_business_access(uuid,text[])
  from public, anon;
grant usage on schema private to anon, authenticated;
grant execute on function private.has_merchant_business_access(uuid,text[])
  to anon, authenticated;

create or replace function private.is_merchant_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $merchant$
  select auth.uid() is not null and public.is_admin();
$merchant$;

revoke all on function private.is_merchant_admin() from public;
grant execute on function private.is_merchant_admin() to anon, authenticated;

drop policy if exists merchant_businesses_public_or_member_read on public.merchant_businesses;
create policy merchant_businesses_public_or_member_read
  on public.merchant_businesses
  for select to anon, authenticated
  using (
    review_status = 'approved'
    or private.has_merchant_business_access(id)
    or private.is_merchant_admin()
  );

drop policy if exists merchant_memberships_owner_or_admin_read on public.merchant_memberships;
create policy merchant_memberships_owner_or_admin_read
  on public.merchant_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.has_merchant_business_access(business_id, array['owner','manager']::text[])
    or private.is_merchant_admin()
  );

drop policy if exists merchant_locations_public_or_member_read on public.merchant_locations;
create policy merchant_locations_public_or_member_read
  on public.merchant_locations
  for select to anon, authenticated
  using (
    (
      is_active is true
      and exists (
        select 1 from public.merchant_businesses mb
         where mb.id = merchant_locations.business_id
           and mb.review_status = 'approved'
      )
    )
    or private.has_merchant_business_access(business_id)
    or (auth.uid() is not null and public.is_admin())
  );

-- Client roles receive read-only table access. All writes go through scoped RPCs.
revoke all on public.merchant_businesses, public.merchant_memberships, public.merchant_locations
  from public, anon, authenticated;
-- Never expose owner_user_id through public business-directory reads.
grant select (
  id, business_name, description, business_category, public_phone,
  website_url, review_status, created_at, updated_at
) on public.merchant_businesses to anon, authenticated;
grant select on public.merchant_locations to anon, authenticated;
grant select on public.merchant_memberships to authenticated;

create or replace function public.create_merchant_business(
  p_business_name text,
  p_description text default null,
  p_business_category text default null,
  p_public_phone text default null,
  p_website_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.users u
     where u.id = v_user_id
       and u.account_status = 'active'::public.account_status_type
  ) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_business_name is null or char_length(trim(p_business_name)) not between 2 and 120 then
    raise exception 'Nama bisnis harus 2-120 karakter' using errcode = '22023';
  end if;

  insert into public.merchant_businesses (
    owner_user_id, business_name, description, business_category, public_phone, website_url
  ) values (
    v_user_id, trim(p_business_name), nullif(trim(p_description), ''),
    nullif(trim(p_business_category), ''), nullif(trim(p_public_phone), ''),
    nullif(trim(p_website_url), '')
  ) returning id into v_business_id;

  insert into public.merchant_memberships (
    business_id, user_id, member_role, membership_status, accepted_at
  ) values (v_business_id, v_user_id, 'owner', 'active', now());

  return v_business_id;
end;
$$;

create or replace function public.update_merchant_business_profile(
  p_business_id uuid,
  p_business_name text,
  p_description text default null,
  p_business_category text default null,
  p_public_phone text default null,
  p_website_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner']::text[]) then
    raise exception 'Only the business owner can edit business identity' using errcode = '42501';
  end if;
  if p_business_name is null or char_length(trim(p_business_name)) not between 2 and 120
     or (p_description is not null and char_length(p_description) > 2000)
     or (p_business_category is not null and char_length(p_business_category) > 80)
     or (p_public_phone is not null and char_length(p_public_phone) > 40)
     or (p_website_url is not null and char_length(p_website_url) > 500) then
    raise exception 'Data bisnis tidak valid' using errcode = '22023';
  end if;

  update public.merchant_businesses
     set business_name = trim(p_business_name),
         description = nullif(trim(p_description), ''),
         business_category = nullif(trim(p_business_category), ''),
         public_phone = nullif(trim(p_public_phone), ''),
         website_url = nullif(trim(p_website_url), ''),
         updated_at = now()
   where id = p_business_id
     and review_status in ('draft','needs_revision');

  if not found then
    raise exception 'Business profile can only be edited while draft or returned for revision' using errcode = '55000';
  end if;
  return true;
end;
$merchant$;

create or replace function public.submit_merchant_business_for_review(p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner']::text[]) then
    raise exception 'Only the business owner can submit this business' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.merchant_businesses mb
     where mb.id = p_business_id
       and mb.review_status in ('draft','needs_revision')
       and char_length(trim(mb.business_name)) between 2 and 120
  ) then
    raise exception 'Business is not ready for submission' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.merchant_locations ml
     where ml.business_id = p_business_id
       and ml.is_active is true
  ) then
    raise exception 'Add at least one active business location before submission' using errcode = '22023';
  end if;

  update public.merchant_businesses
     set review_status = 'pending_review',
         updated_at = now()
   where id = p_business_id;
  return true;
end;
$merchant$;

create or replace function public.add_merchant_location(
  p_business_id uuid,
  p_location_name text,
  p_address_text text,
  p_city text default null,
  p_province text default null,
  p_public_phone text default null,
  p_opening_hours jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner','manager']::text[]) then
    raise exception 'Merchant owner or manager access required' using errcode = '42501';
  end if;
  if p_location_name is null or char_length(trim(p_location_name)) not between 2 and 120
     or p_address_text is null or char_length(trim(p_address_text)) not between 5 and 500
     or jsonb_typeof(coalesce(p_opening_hours, '{}'::jsonb)) <> 'object' then
    raise exception 'Data lokasi tidak valid' using errcode = '22023';
  end if;

  insert into public.merchant_locations (
    business_id, location_name, address_text, city, province, public_phone, opening_hours
  ) values (
    p_business_id, trim(p_location_name), trim(p_address_text),
    nullif(trim(p_city), ''), nullif(trim(p_province), ''),
    nullif(trim(p_public_phone), ''), coalesce(p_opening_hours, '{}'::jsonb)
  ) returning id into v_location_id;

  return v_location_id;
end;
$$;

create or replace function public.invite_merchant_member(
  p_business_id uuid,
  p_user_id uuid,
  p_member_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner']::text[]) then
    raise exception 'Only the business owner can invite members' using errcode = '42501';
  end if;
  if p_member_role not in ('manager','staff') then
    raise exception 'Only manager or staff membership can be invited' using errcode = '22023';
  end if;
  if p_user_id is null or p_user_id = auth.uid()
     or not exists (
       select 1 from public.users u
        where u.id = p_user_id
          and u.account_status = 'active'::public.account_status_type
     ) then
    raise exception 'Target account not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.merchant_memberships mm
     where mm.business_id = p_business_id
       and mm.user_id = p_user_id
       and mm.member_role = 'owner'
  ) then
    raise exception 'Business owner cannot be invited as staff or manager' using errcode = '22023';
  end if;

  insert into public.merchant_memberships (
    business_id, user_id, member_role, membership_status, invited_by, invited_at
  ) values (
    p_business_id, p_user_id, p_member_role, 'pending_invitation', auth.uid(), now()
  )
  on conflict (business_id, user_id) do update
    set member_role = excluded.member_role,
        membership_status = 'pending_invitation',
        invited_by = auth.uid(),
        invited_at = now(),
        accepted_at = null,
        updated_at = now()
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

create or replace function public.accept_merchant_invitation(p_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.users u
     where u.id = auth.uid()
       and u.account_status = 'active'::public.account_status_type
  ) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  update public.merchant_memberships
     set membership_status = 'active',
         accepted_at = now(),
         updated_at = now()
   where id = p_membership_id
     and user_id = auth.uid()
     and membership_status = 'pending_invitation'
     and member_role in ('manager','staff');

  return found;
end;
$$;

revoke all on function public.update_merchant_business_profile(uuid,text,text,text,text,text)
  from public, anon;
revoke all on function public.submit_merchant_business_for_review(uuid)
  from public, anon;
grant execute on function public.update_merchant_business_profile(uuid,text,text,text,text,text)
  to authenticated;
grant execute on function public.submit_merchant_business_for_review(uuid)
  to authenticated;

revoke all on function public.create_merchant_business(text,text,text,text,text)
  from public, anon;
revoke all on function public.add_merchant_location(uuid,text,text,text,text,text,jsonb)
  from public, anon;
revoke all on function public.invite_merchant_member(uuid,uuid,text)
  from public, anon;
revoke all on function public.accept_merchant_invitation(uuid)
  from public, anon;

grant execute on function public.create_merchant_business(text,text,text,text,text)
  to authenticated;
grant execute on function public.add_merchant_location(uuid,text,text,text,text,text,jsonb)
  to authenticated;
grant execute on function public.invite_merchant_member(uuid,uuid,text)
  to authenticated;
grant execute on function public.accept_merchant_invitation(uuid)
  to authenticated;

comment on table public.merchant_businesses is
  'Merchant business identity, separate from user Talent and Professional Provider profiles.';
comment on table public.merchant_memberships is
  'Server-managed membership of people in merchant businesses; users may belong to multiple businesses.';
comment on table public.merchant_locations is
  'Merchant branches/locations; public visibility follows approved business status.';
comment on function public.create_merchant_business(text,text,text,text,text) is
  'Creates a draft merchant business and its owner membership atomically.';
comment on function public.invite_merchant_member(uuid,uuid,text) is
  'Business owner may invite an existing YUKU account as manager or staff; invitee must accept.';

-- Extend the account snapshot so the workspace switcher receives only the
-- authenticated user's own server-confirmed merchant memberships.
create or replace function public.get_my_account_access_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $merchant$
declare
  v_user_id uuid := auth.uid();
  v_account_status text;
  v_customer_available boolean;
  v_talent_status text;
  v_professional_status text;
  v_merchant_memberships jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select u.account_status::text
    into v_account_status
    from public.users u
   where u.id = v_user_id;

  if not found then
    raise exception 'Account record not found' using errcode = 'P0002';
  end if;

  v_customer_available := v_account_status in ('active','pending_verification');

  select case when tp.is_approved is true then 'approved' else 'pending_review' end
    into v_talent_status
    from public.talent_profiles tp
   where tp.id = v_user_id;

  select pp.review_status
    into v_professional_status
    from public.professional_provider_profiles pp
   where pp.user_id = v_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'businessId', mb.id,
        'businessName', mb.business_name,
        'role', mm.member_role,
        'status', mm.membership_status,
        'businessStatus', mb.review_status
      ) order by mm.created_at
    ),
    '[]'::jsonb
  )
    into v_merchant_memberships
    from public.merchant_memberships mm
    join public.merchant_businesses mb on mb.id = mm.business_id
   where mm.user_id = v_user_id
     and mm.membership_status in ('active','pending_invitation');

  return jsonb_build_object(
    'accountStatus', v_account_status,
    'capabilities', jsonb_build_object(
      'customer', jsonb_build_object('available', v_customer_available),
      'talent', case when v_talent_status is null then null
        else jsonb_build_object('status', v_talent_status) end,
      'professionalProvider', case when v_professional_status is null then null
        else jsonb_build_object('status', v_professional_status) end,
      'merchantMemberships', v_merchant_memberships
    )
  );
end;
$merchant$;

revoke all on function public.get_my_account_access_snapshot()
  from public, anon;
grant execute on function public.get_my_account_access_snapshot()
  to authenticated;

commit;
