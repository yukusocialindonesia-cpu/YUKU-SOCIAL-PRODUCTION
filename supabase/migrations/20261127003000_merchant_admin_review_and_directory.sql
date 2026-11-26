-- Merchant Partner: Admin review lifecycle and public directory release gate.
-- Additive draft migration. Apply only after SQL review and staging RLS/JWT tests.

begin;

alter table public.merchant_businesses
  alter column review_status set default 'draft';

create table if not exists public.merchant_business_review_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.merchant_businesses(id) on delete cascade,
  from_status text null check (from_status is null or from_status in ('draft','pending_review','needs_revision','approved','rejected','suspended')),
  to_status text not null check (to_status in ('draft','pending_review','needs_revision','approved','rejected','suspended')),
  decision_note text null check (decision_note is null or char_length(decision_note) <= 1200),
  actor_user_id uuid null references public.users(id) on delete set null,
  actor_role text not null check (actor_role in ('owner','admin','system')),
  created_at timestamptz not null default now()
);

create index if not exists merchant_business_review_history_business_created_idx
  on public.merchant_business_review_history (business_id, created_at desc, id desc);

alter table public.merchant_business_review_history enable row level security;

drop policy if exists merchant_review_history_owner_or_admin_read on public.merchant_business_review_history;
create policy merchant_review_history_owner_or_admin_read
  on public.merchant_business_review_history
  for select to authenticated
  using (
    private.has_merchant_business_access(business_id)
    or private.is_merchant_admin()
  );

revoke all on public.merchant_business_review_history from public, anon, authenticated;
grant select (id,business_id,from_status,to_status,decision_note,actor_role,created_at)
  on public.merchant_business_review_history to authenticated;

-- Replace submission RPC so resubmissions are recorded in the review timeline.
create or replace function public.submit_merchant_business_for_review(p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_previous_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_merchant_business_access(p_business_id, array['owner']::text[]) then
    raise exception 'Only the business owner can submit this business' using errcode = '42501';
  end if;

  select mb.review_status into v_previous_status
    from public.merchant_businesses mb
   where mb.id = p_business_id
     and mb.review_status in ('draft','needs_revision')
   for update;

  if not found then
    raise exception 'Business is not ready for submission' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.merchant_locations ml
     where ml.business_id = p_business_id and ml.is_active is true
  ) then
    raise exception 'Add at least one active business location before submission' using errcode = '22023';
  end if;

  update public.merchant_businesses
     set review_status = 'pending_review', updated_at = now()
   where id = p_business_id;

  insert into public.merchant_business_review_history (
    business_id, from_status, to_status, decision_note, actor_user_id, actor_role
  ) values (
    p_business_id, v_previous_status, 'pending_review', null, auth.uid(), 'owner'
  );
  return true;
end;
$merchant$;

create or replace function public.admin_review_merchant_business(
  p_business_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $merchant$
declare
  v_previous_status text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved','needs_revision','rejected','suspended') then
    raise exception 'Unsupported merchant review decision' using errcode = '22023';
  end if;
  if p_decision in ('needs_revision','rejected','suspended')
     and char_length(trim(coalesce(p_decision_note,''))) < 8 then
    raise exception 'Catatan keputusan minimal 8 karakter' using errcode = '22023';
  end if;
  if p_decision_note is not null and char_length(p_decision_note) > 1200 then
    raise exception 'Catatan terlalu panjang' using errcode = '22023';
  end if;

  select mb.review_status into v_previous_status
    from public.merchant_businesses mb
   where mb.id = p_business_id
   for update;

  if not found then
    raise exception 'Merchant business not found' using errcode = 'P0002';
  end if;

  if p_decision = 'suspended' then
    if v_previous_status <> 'approved' then
      raise exception 'Only an approved business can be suspended' using errcode = '55000';
    end if;
  elsif v_previous_status <> 'pending_review' then
    raise exception 'Only a pending-review business can receive this decision' using errcode = '55000';
  end if;

  if p_decision = 'approved' and not exists (
    select 1 from public.merchant_locations ml
     where ml.business_id = p_business_id and ml.is_active is true
  ) then
    raise exception 'Business must have at least one active location' using errcode = '22023';
  end if;

  update public.merchant_businesses
     set review_status = p_decision,
         updated_at = now()
   where id = p_business_id;

  insert into public.merchant_business_review_history (
    business_id, from_status, to_status, decision_note, actor_user_id, actor_role
  ) values (
    p_business_id, v_previous_status, p_decision,
    nullif(trim(p_decision_note), ''), auth.uid(), 'admin'
  );
  return true;
end;
$merchant$;

revoke all on function public.admin_review_merchant_business(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_review_merchant_business(uuid,text,text)
  to authenticated;

comment on table public.merchant_business_review_history is
  'Append-only audit timeline for merchant owner submissions and Super Admin review decisions.';
comment on function public.admin_review_merchant_business(uuid,text,text) is
  'Super Admin-only merchant review decision; publishes only explicitly approved businesses.';

commit;
