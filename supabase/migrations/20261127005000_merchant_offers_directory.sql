-- Merchant Partner offers: informational promotions redeemed directly with the merchant.
-- No checkout, voucher balance, payment, commission, or settlement is implemented here.
-- Draft migration. Apply only after staging SQL/RLS and lifecycle tests pass.

begin;

create table if not exists public.merchant_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.merchant_businesses(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null check (char_length(trim(description)) between 10 and 1200),
  offer_type text not null check (offer_type in ('discount','bundle','event','benefit','other')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  terms text null check (terms is null or char_length(terms) <= 1000),
  redemption_instructions text null check (redemption_instructions is null or char_length(redemption_instructions) <= 500),
  status text not null default 'draft'
    check (status in ('draft','pending_review','approved','needs_revision','rejected','suspended')),
  created_by uuid not null references public.users(id) on delete restrict,
  reviewed_by uuid null references public.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_offer_date_range_check
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists merchant_offers_business_status_idx
  on public.merchant_offers (business_id,status,starts_at desc);
create index if not exists merchant_offers_public_active_idx
  on public.merchant_offers (status,starts_at,ends_at)
  where status = 'approved';

create table if not exists public.merchant_offer_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.merchant_offers(id) on delete cascade,
  business_id uuid not null references public.merchant_businesses(id) on delete cascade,
  from_status text null,
  to_status text not null,
  decision_note text null check (decision_note is null or char_length(decision_note) <= 1200),
  actor_user_id uuid null references public.users(id) on delete set null,
  actor_role text not null check (actor_role in ('owner','admin','system')),
  created_at timestamptz not null default now()
);

create index if not exists merchant_offer_history_offer_created_idx
  on public.merchant_offer_history (offer_id,created_at desc,id desc);

alter table public.merchant_offers enable row level security;
alter table public.merchant_offer_history enable row level security;

drop policy if exists merchant_offers_public_or_member_read on public.merchant_offers;
create policy merchant_offers_public_or_member_read
  on public.merchant_offers
  for select to anon,authenticated
  using (
    (
      status = 'approved'
      and starts_at <= now()
      and (ends_at is null or ends_at >= now())
      and exists (
        select 1 from public.merchant_businesses mb
         where mb.id = merchant_offers.business_id
           and mb.review_status = 'approved'
      )
    )
    or private.has_merchant_business_access(business_id)
    or private.is_merchant_admin()
  );

drop policy if exists merchant_offer_history_owner_admin_read on public.merchant_offer_history;
create policy merchant_offer_history_owner_admin_read
  on public.merchant_offer_history
  for select to authenticated
  using (
    private.has_merchant_business_access(business_id,array['owner']::text[])
    or private.is_merchant_admin()
  );

revoke all on public.merchant_offers,public.merchant_offer_history
  from public,anon,authenticated;
grant select (
  id,business_id,title,description,offer_type,starts_at,ends_at,terms,
  redemption_instructions,status,created_at,updated_at
) on public.merchant_offers to anon,authenticated;
grant select (
  id,offer_id,business_id,from_status,to_status,decision_note,actor_role,created_at
) on public.merchant_offer_history to authenticated;

create or replace function public.save_merchant_offer(
  p_business_id uuid,
  p_offer_id uuid,
  p_title text,
  p_description text,
  p_offer_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_terms text,
  p_redemption_instructions text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_offer_id uuid;
  v_existing_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id,array['owner','manager']::text[]) then
    raise exception 'Merchant owner or manager access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.merchant_businesses mb
     where mb.id = p_business_id and mb.review_status = 'approved'
  ) then
    raise exception 'Business must be approved before publishing offers' using errcode = '55000';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 3 and 100
     or p_description is null or char_length(trim(p_description)) not between 10 and 1200
     or p_offer_type is null or p_offer_type not in ('discount','bundle','event','benefit','other')
     or (p_ends_at is not null and p_ends_at <= coalesce(p_starts_at,now()))
     or (p_terms is not null and char_length(p_terms) > 1000)
     or (p_redemption_instructions is not null and char_length(p_redemption_instructions) > 500) then
    raise exception 'Informasi promo tidak valid' using errcode = '22023';
  end if;

  if p_offer_id is null then
    insert into public.merchant_offers (
      business_id,title,description,offer_type,starts_at,ends_at,terms,
      redemption_instructions,created_by
    ) values (
      p_business_id,trim(p_title),trim(p_description),p_offer_type,
      coalesce(p_starts_at,now()),p_ends_at,nullif(trim(p_terms),''),
      nullif(trim(p_redemption_instructions),''),auth.uid()
    ) returning id into v_offer_id;
    return v_offer_id;
  end if;

  select mo.status into v_existing_status
    from public.merchant_offers mo
   where mo.id = p_offer_id and mo.business_id = p_business_id
   for update;
  if not found then
    raise exception 'Offer not found for this business' using errcode = 'P0002';
  end if;
  if v_existing_status not in ('draft','needs_revision','approved') then
    raise exception 'Offer cannot be edited while review is in progress or after rejection/suspension' using errcode = '55000';
  end if;

  update public.merchant_offers
     set title = trim(p_title),
         description = trim(p_description),
         offer_type = p_offer_type,
         starts_at = coalesce(p_starts_at,now()),
         ends_at = p_ends_at,
         terms = nullif(trim(p_terms),''),
         redemption_instructions = nullif(trim(p_redemption_instructions),''),
         status = 'draft',
         reviewed_by = null,
         reviewed_at = null,
         updated_at = now()
   where id = p_offer_id;
  insert into public.merchant_offer_history (
    offer_id,business_id,from_status,to_status,decision_note,actor_user_id,actor_role
  ) values (
    p_offer_id,p_business_id,v_existing_status,'draft',
    case when v_existing_status = 'approved' then 'Promo diperbarui oleh merchant dan menunggu pengajuan ulang.' else null end,
    auth.uid(),
    case when private.has_merchant_business_access(p_business_id,array['owner']::text[]) then 'owner' else 'owner' end
  );
  return p_offer_id;
end;
$merchant$;

create or replace function public.submit_merchant_offer_for_review(p_offer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_business_id uuid;
  v_previous_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select mo.business_id,mo.status
    into v_business_id,v_previous_status
    from public.merchant_offers mo
   where mo.id = p_offer_id
   for update;
  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if not private.has_merchant_business_access(v_business_id,array['owner']::text[]) then
    raise exception 'Only the business owner can submit offers for review' using errcode = '42501';
  end if;
  if v_previous_status not in ('draft','needs_revision') then
    raise exception 'Offer is not ready for submission' using errcode = '55000';
  end if;

  update public.merchant_offers
     set status = 'pending_review',updated_at = now()
   where id = p_offer_id;
  insert into public.merchant_offer_history (
    offer_id,business_id,from_status,to_status,actor_user_id,actor_role
  ) values (p_offer_id,v_business_id,v_previous_status,'pending_review',auth.uid(),'owner');
  return true;
end;
$merchant$;

create or replace function public.admin_review_merchant_offer(
  p_offer_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_business_id uuid;
  v_owner_user_id uuid;
  v_business_name text;
  v_offer_title text;
  v_previous_status text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved','needs_revision','rejected','suspended') then
    raise exception 'Unsupported offer review decision' using errcode = '22023';
  end if;
  if p_decision in ('needs_revision','rejected','suspended')
     and char_length(trim(coalesce(p_decision_note,''))) < 8 then
    raise exception 'Catatan keputusan minimal 8 karakter' using errcode = '22023';
  end if;
  if p_decision_note is not null and char_length(p_decision_note) > 1200 then
    raise exception 'Catatan keputusan terlalu panjang' using errcode = '22023';
  end if;

  select mo.business_id,mo.status,mb.owner_user_id,mb.business_name,mo.title
    into v_business_id,v_previous_status,v_owner_user_id,v_business_name,v_offer_title
    from public.merchant_offers mo
    join public.merchant_businesses mb on mb.id = mo.business_id
   where mo.id = p_offer_id
   for update of mo;
  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if p_decision = 'suspended' then
    if v_previous_status <> 'approved' then
      raise exception 'Only an approved offer can be suspended' using errcode = '55000';
    end if;
  elsif v_previous_status <> 'pending_review' then
    raise exception 'Only a pending offer can receive this decision' using errcode = '55000';
  end if;
  if p_decision = 'approved' and not exists (
    select 1 from public.merchant_businesses mb
     where mb.id = v_business_id and mb.review_status = 'approved'
  ) then
    raise exception 'Parent business must remain approved before an offer can be published' using errcode = '55000';
  end if;

  update public.merchant_offers
     set status = p_decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   where id = p_offer_id;

  insert into public.merchant_offer_history (
    offer_id,business_id,from_status,to_status,decision_note,actor_user_id,actor_role
  ) values (
    p_offer_id,v_business_id,v_previous_status,p_decision,
    nullif(trim(p_decision_note),''),auth.uid(),'admin'
  );

  perform public.create_in_app_notification(
    v_owner_user_id,
    case p_decision
      when 'approved' then 'Promo Merchant Partner Disetujui'
      when 'needs_revision' then 'Promo Merchant Perlu Perbaikan'
      when 'rejected' then 'Promo Merchant Belum Disetujui'
      else 'Promo Merchant Dinonaktifkan'
    end,
    case p_decision
      when 'approved' then 'Promo "' || v_offer_title || '" untuk bisnis ' || v_business_name || ' telah disetujui.'
      when 'needs_revision' then 'Promo "' || v_offer_title || '" perlu diperbaiki. Catatan YUKU: ' || trim(p_decision_note)
      when 'rejected' then 'Promo "' || v_offer_title || '" belum disetujui. Catatan YUKU: ' || trim(p_decision_note)
      else 'Promo "' || v_offer_title || '" dinonaktifkan. Catatan YUKU: ' || trim(p_decision_note)
    end,
    'system_alert'::public.notification_type,
    jsonb_build_object('route','/merchant-center','merchant_business_id',v_business_id,'merchant_offer_id',p_offer_id,'event','merchant_offer_review','decision',p_decision)
  );

  return true;
end;
$merchant$;

revoke all on function public.save_merchant_offer(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text)
  from public,anon,authenticated;
revoke all on function public.submit_merchant_offer_for_review(uuid)
  from public,anon,authenticated;
revoke all on function public.admin_review_merchant_offer(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.save_merchant_offer(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text)
  to authenticated;
grant execute on function public.submit_merchant_offer_for_review(uuid)
  to authenticated;
grant execute on function public.admin_review_merchant_offer(uuid,text,text)
  to authenticated;

comment on table public.merchant_offers is
  'Informational merchant promotions. Redemption and payment happen directly with the merchant; no YUKU checkout.';
comment on table public.merchant_offer_history is
  'Append-only review history for Merchant Partner offers.';
comment on function public.save_merchant_offer(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text) is
  'Owner/manager can create or edit draft offers; only owner can submit them for review.';

commit;
