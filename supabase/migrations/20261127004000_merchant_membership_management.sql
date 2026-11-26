-- Merchant Partner membership management: invite by email, member roster, revoke and audit.
-- Draft migration. Apply only to a disposable/staging project after SQL review.

begin;

-- Website links are public contact data; never persist executable or non-web schemes.
do $merchant$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.merchant_businesses'::regclass
       and conname = 'merchant_businesses_website_http_check'
  ) then
    alter table public.merchant_businesses
      add constraint merchant_businesses_website_http_check
      check (website_url is null or website_url ~* '^https?://[^[:space:]]+$')
      not valid;
  end if;
end;
$merchant$;

create table if not exists public.merchant_membership_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.merchant_businesses(id) on delete cascade,
  membership_id uuid null references public.merchant_memberships(id) on delete set null,
  target_user_id uuid null references public.users(id) on delete set null,
  actor_user_id uuid null references public.users(id) on delete set null,
  action text not null check (action in ('invited','reinvited','accepted','revoked')),
  previous_role text null check (previous_role is null or previous_role in ('manager','staff','owner')),
  new_role text null check (new_role is null or new_role in ('manager','staff','owner')),
  previous_status text null,
  new_status text null,
  created_at timestamptz not null default now()
);

create index if not exists merchant_membership_history_business_created_idx
  on public.merchant_membership_history (business_id, created_at desc);

alter table public.merchant_membership_history enable row level security;
drop policy if exists merchant_membership_history_owner_manager_read
  on public.merchant_membership_history;
create policy merchant_membership_history_owner_manager_read
  on public.merchant_membership_history
  for select to authenticated
  using (
    private.has_merchant_business_access(business_id, array['owner','manager']::text[])
    or private.is_merchant_admin()
  );

revoke all on public.merchant_membership_history from public, anon, authenticated;
grant select (id,business_id,membership_id,action,previous_role,new_role,previous_status,new_status,created_at)
  on public.merchant_membership_history to authenticated;

-- Pending invitees may read the business identity needed to review and accept
-- their own invitation. This grants no location or management access.
create or replace function private.has_merchant_business_invitation(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $merchant$
  select auth.uid() is not null and exists (
    select 1
      from public.merchant_memberships mm
     where mm.business_id = p_business_id
       and mm.user_id = auth.uid()
       and mm.membership_status = 'pending_invitation'
       and mm.member_role in ('manager','staff')
  );
$merchant$;

revoke all on function private.has_merchant_business_invitation(uuid)
  from public,anon;
grant execute on function private.has_merchant_business_invitation(uuid)
  to anon, authenticated;

drop policy if exists merchant_businesses_public_or_member_read
  on public.merchant_businesses;
create policy merchant_businesses_public_or_member_read
  on public.merchant_businesses
  for select to anon, authenticated
  using (
    review_status = 'approved'
    or private.has_merchant_business_access(id)
    or private.has_merchant_business_invitation(id)
    or private.is_merchant_admin()
  );

-- Owner and manager may view the roster; email is returned only by this scoped RPC.
create or replace function public.get_merchant_business_members(p_business_id uuid)
returns table (
  membership_id uuid,
  email text,
  member_role text,
  membership_status text,
  invited_at timestamptz,
  accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $merchant$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(
    p_business_id, array['owner','manager']::text[]
  ) then
    raise exception 'Merchant owner or manager access required' using errcode = '42501';
  end if;

  return query
    select mm.id,
           case
             when private.has_merchant_business_access(
               p_business_id, array['owner']::text[]
             ) then au.email::text
             else null
           end,
           mm.member_role, mm.membership_status, mm.invited_at, mm.accepted_at
      from public.merchant_memberships mm
      join auth.users au on au.id = mm.user_id
     where mm.business_id = p_business_id
       and mm.member_role in ('owner','manager','staff')
       and mm.membership_status in ('active','pending_invitation')
     order by case mm.member_role when 'owner' then 0 when 'manager' then 1 else 2 end,
              mm.created_at;
end;
$merchant$;

-- Invite an existing active YUKU account by email without exposing the user directory.
create or replace function public.invite_merchant_member_by_email(
  p_business_id uuid,
  p_email text,
  p_member_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_target_user_id uuid;
  v_membership_id uuid;
  v_previous_role text;
  v_previous_status text;
  v_business_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner']::text[]) then
    raise exception 'Only the business owner can invite members' using errcode = '42501';
  end if;
  if p_member_role is null or p_member_role not in ('manager','staff') then
    raise exception 'Role undangan hanya Manager atau Staff' using errcode = '22023';
  end if;
  if p_email is null or char_length(trim(p_email)) not between 5 and 254
     or position('@' in trim(p_email)) < 2 then
    raise exception 'Alamat email tidak valid' using errcode = '22023';
  end if;

  select au.id into v_target_user_id
    from auth.users au
    join public.users u on u.id = au.id
   where lower(au.email) = lower(trim(p_email))
     and u.account_status = 'active'::public.account_status_type
   limit 1;

  if v_target_user_id is null then
    raise exception 'Akun YUKU aktif dengan email tersebut tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_target_user_id = auth.uid() then
    raise exception 'Owner tidak dapat mengundang dirinya sendiri' using errcode = '22023';
  end if;

  select mm.member_role, mm.membership_status
    into v_previous_role, v_previous_status
    from public.merchant_memberships mm
   where mm.business_id = p_business_id and mm.user_id = v_target_user_id
   for update;

  if found and v_previous_role = 'owner' then
    raise exception 'Owner bisnis tidak dapat diubah menjadi anggota' using errcode = '22023';
  end if;
  if found and v_previous_status = 'active' then
    raise exception 'Akun ini sudah menjadi anggota aktif bisnis' using errcode = '23505';
  end if;

  insert into public.merchant_memberships (
    business_id,user_id,member_role,membership_status,invited_by,invited_at,accepted_at
  ) values (
    p_business_id,v_target_user_id,p_member_role,'pending_invitation',auth.uid(),now(),null
  )
  on conflict (business_id,user_id) do update
    set member_role = excluded.member_role,
        membership_status = 'pending_invitation',
        invited_by = auth.uid(),
        invited_at = now(),
        accepted_at = null,
        updated_at = now()
  returning id into v_membership_id;

  insert into public.merchant_membership_history (
    business_id,membership_id,target_user_id,actor_user_id,action,
    previous_role,new_role,previous_status,new_status
  ) values (
    p_business_id,v_membership_id,v_target_user_id,auth.uid(),
    case when v_previous_status is null then 'invited' else 'reinvited' end,
    v_previous_role,p_member_role,v_previous_status,'pending_invitation'
  );

  select mb.business_name into v_business_name
    from public.merchant_businesses mb where mb.id = p_business_id;
  perform public.create_in_app_notification(
    v_target_user_id,
    'Undangan Tim Merchant Partner',
    'Anda menerima undangan sebagai ' || case when p_member_role = 'manager' then 'Manager' else 'Staff' end
      || ' untuk bisnis ' || coalesce(v_business_name,'Merchant Partner')
      || '. Buka Merchant Center untuk meninjau dan menerima undangan.',
    'system_alert'::public.notification_type,
    jsonb_build_object(
      'route','/merchant-center',
      'merchant_business_id',p_business_id,
      'merchant_membership_id',v_membership_id,
      'event','merchant_invitation'
    )
  );

  return v_membership_id;
end;
$merchant$;

create or replace function public.revoke_merchant_business_member(
  p_business_id uuid,
  p_membership_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_target_user_id uuid;
  v_previous_role text;
  v_previous_status text;
  v_business_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner']::text[]) then
    raise exception 'Only the business owner can revoke members' using errcode = '42501';
  end if;

  select mm.user_id,mm.member_role,mm.membership_status
    into v_target_user_id,v_previous_role,v_previous_status
    from public.merchant_memberships mm
   where mm.id = p_membership_id
     and mm.business_id = p_business_id
     and mm.member_role in ('manager','staff')
     and mm.membership_status in ('active','pending_invitation')
   for update;

  if not found then
    raise exception 'Anggota tidak ditemukan atau tidak dapat dicabut' using errcode = 'P0002';
  end if;

  update public.merchant_memberships
     set membership_status = 'revoked', updated_at = now()
   where id = p_membership_id;

  insert into public.merchant_membership_history (
    business_id,membership_id,target_user_id,actor_user_id,action,
    previous_role,new_role,previous_status,new_status
  ) values (
    p_business_id,p_membership_id,v_target_user_id,auth.uid(),'revoked',
    v_previous_role,v_previous_role,v_previous_status,'revoked'
  );

  select mb.business_name into v_business_name
    from public.merchant_businesses mb where mb.id = p_business_id;
  perform public.create_in_app_notification(
    v_target_user_id,
    'Akses Merchant Partner Dicabut',
    'Akses Anda ke bisnis ' || coalesce(v_business_name,'Merchant Partner')
      || ' telah dicabut oleh Owner bisnis.',
    'system_alert'::public.notification_type,
    jsonb_build_object(
      'route','/merchant-center',
      'merchant_business_id',p_business_id,
      'event','merchant_membership_revoked'
    )
  );
  return true;
end;
$merchant$;

-- Adding a branch to an already-approved business triggers a fresh review.
-- This prevents newly added, unreviewed addresses from appearing publicly.
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
as $merchant$
declare
  v_location_id uuid;
  v_business_status text;
  v_is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_is_owner := private.has_merchant_business_access(
    p_business_id, array['owner']::text[]
  );

  if not v_is_owner and not private.has_merchant_business_access(
    p_business_id, array['manager']::text[]
  ) then
    raise exception 'Merchant owner or manager access required' using errcode = '42501';
  end if;

  select mb.review_status into v_business_status
    from public.merchant_businesses mb
   where mb.id = p_business_id
   for update;

  if not found then
    raise exception 'Merchant business not found' using errcode = 'P0002';
  end if;

  if v_business_status = 'approved' and not v_is_owner then
    raise exception 'Only the business owner can add a branch to an approved business' using errcode = '42501';
  end if;
  if v_business_status not in ('draft','needs_revision','approved') then
    raise exception 'Branches cannot be changed while business review is in progress or business is suspended/rejected' using errcode = '55000';
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

  if v_business_status = 'approved' then
    update public.merchant_businesses
       set review_status = 'needs_revision', updated_at = now()
     where id = p_business_id;

    insert into public.merchant_business_review_history (
      business_id,from_status,to_status,decision_note,actor_user_id,actor_role
    ) values (
      p_business_id,'approved','needs_revision',
      'Penambahan lokasi baru memerlukan pemeriksaan ulang.',
      auth.uid(),'owner'
    );
  end if;

  return v_location_id;
end;
$merchant$;

-- Edit or deactivate an existing branch. Changes to an approved business
-- require a fresh business review so public addresses stay moderated.
create or replace function public.update_merchant_location(
  p_business_id uuid,
  p_location_id uuid,
  p_location_name text,
  p_address_text text,
  p_city text default null,
  p_province text default null,
  p_public_phone text default null,
  p_opening_hours jsonb default '{}'::jsonb,
  p_is_active boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_business_status text;
  v_is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_is_owner := private.has_merchant_business_access(
    p_business_id, array['owner']::text[]
  );
  if not v_is_owner and not private.has_merchant_business_access(
    p_business_id, array['manager']::text[]
  ) then
    raise exception 'Merchant owner or manager access required' using errcode = '42501';
  end if;

  select mb.review_status into v_business_status
    from public.merchant_businesses mb
   where mb.id = p_business_id
   for update;
  if not found then
    raise exception 'Merchant business not found' using errcode = 'P0002';
  end if;
  if v_business_status = 'approved' and not v_is_owner then
    raise exception 'Only the business owner can change an approved branch' using errcode = '42501';
  end if;
  if v_business_status not in ('draft','needs_revision','approved') then
    raise exception 'Branches cannot be changed while review is in progress or business is rejected/suspended' using errcode = '55000';
  end if;
  if p_location_name is null or char_length(trim(p_location_name)) not between 2 and 120
     or p_address_text is null or char_length(trim(p_address_text)) not between 5 and 500
     or (p_public_phone is not null and char_length(p_public_phone) > 40)
     or jsonb_typeof(coalesce(p_opening_hours, '{}'::jsonb)) <> 'object' then
    raise exception 'Data lokasi tidak valid' using errcode = '22023';
  end if;

  update public.merchant_locations
     set location_name = trim(p_location_name),
         address_text = trim(p_address_text),
         city = nullif(trim(p_city), ''),
         province = nullif(trim(p_province), ''),
         public_phone = nullif(trim(p_public_phone), ''),
         opening_hours = coalesce(p_opening_hours, '{}'::jsonb),
         is_active = coalesce(p_is_active, true),
         updated_at = now()
   where id = p_location_id
     and business_id = p_business_id;
  if not found then
    raise exception 'Lokasi tidak ditemukan pada bisnis ini' using errcode = 'P0002';
  end if;

  if v_business_status = 'approved' then
    update public.merchant_businesses
       set review_status = 'needs_revision', updated_at = now()
     where id = p_business_id;
    insert into public.merchant_business_review_history (
      business_id,from_status,to_status,decision_note,actor_user_id,actor_role
    ) values (
      p_business_id,'approved','needs_revision',
      'Perubahan alamat atau informasi cabang memerlukan pemeriksaan ulang.',
      auth.uid(),'owner'
    );
  end if;
  return true;
end;
$merchant$;

-- Replace invitation acceptance so activation is auditable and remains invitee-only.
create or replace function public.accept_merchant_invitation(p_membership_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_business_id uuid;
  v_member_role text;
  v_owner_user_id uuid;
  v_business_name text;
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

  update public.merchant_memberships mm
     set membership_status = 'active',
         accepted_at = now(),
         updated_at = now()
    from public.merchant_businesses mb
   where mm.id = p_membership_id
     and mm.user_id = auth.uid()
     and mm.membership_status = 'pending_invitation'
     and mm.member_role in ('manager','staff')
     and mb.id = mm.business_id
     and mb.review_status not in ('rejected','suspended')
  returning mm.business_id,mm.member_role into v_business_id,v_member_role;

  if not found then
    return false;
  end if;

  insert into public.merchant_membership_history (
    business_id,membership_id,target_user_id,actor_user_id,action,
    previous_role,new_role,previous_status,new_status
  ) values (
    v_business_id,p_membership_id,auth.uid(),auth.uid(),'accepted',
    v_member_role,v_member_role,'pending_invitation','active'
  );

  select mb.owner_user_id,mb.business_name
    into v_owner_user_id,v_business_name
    from public.merchant_businesses mb where mb.id = v_business_id;
  if v_owner_user_id is not null then
    perform public.create_in_app_notification(
      v_owner_user_id,
      'Undangan Merchant Partner Diterima',
      'Anggota baru telah menerima undangan dan kini memiliki akses sebagai '
        || case when v_member_role = 'manager' then 'Manager' else 'Staff' end
        || ' di bisnis ' || coalesce(v_business_name,'Merchant Partner') || '.',
      'system_alert'::public.notification_type,
      jsonb_build_object(
        'route','/merchant-center',
        'merchant_business_id',v_business_id,
        'merchant_membership_id',p_membership_id,
        'event','merchant_invitation_accepted'
      )
    );
  end if;
  return true;
end;
$merchant$;

revoke all on function public.get_merchant_business_members(uuid)
  from public,anon,authenticated;
revoke all on function public.invite_merchant_member_by_email(uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.revoke_merchant_business_member(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.accept_merchant_invitation(uuid)
  from public,anon,authenticated;
revoke all on function public.update_merchant_location(uuid,uuid,text,text,text,text,text,jsonb,boolean)
  from public,anon,authenticated;

grant execute on function public.get_merchant_business_members(uuid) to authenticated;
grant execute on function public.invite_merchant_member_by_email(uuid,text,text) to authenticated;
grant execute on function public.revoke_merchant_business_member(uuid,uuid) to authenticated;
grant execute on function public.accept_merchant_invitation(uuid) to authenticated;
grant execute on function public.update_merchant_location(uuid,uuid,text,text,text,text,text,jsonb,boolean)
  to authenticated;

comment on table public.merchant_membership_history is
  'Audit history for Merchant Partner invitations, acceptances and membership revocations.';
comment on function public.invite_merchant_member_by_email(uuid,text,text) is
  'Owner-only invitation of an existing active YUKU account by email; does not expose the account directory.';
comment on function public.get_merchant_business_members(uuid) is
  'Owner/manager-scoped merchant roster. Email is disclosed only to authorized business members.';

commit;
