-- YUKU Merchant Partner staging preflight (READ ONLY).
-- Run only AFTER applying draft migrations 20261127002000 through 20261127005000
-- to a disposable/staging Supabase project. Never use this as a Production migration.
-- This checks schema, RLS flags, and grants; it does NOT replace JWT/RLS behavior tests.

do $preflight$
declare
  v_table text;
  v_required_tables text[] := array[
    'merchant_businesses',
    'merchant_memberships',
    'merchant_locations',
    'merchant_business_review_history',
    'merchant_membership_history',
    'merchant_offers',
    'merchant_offer_history'
  ];
  v_required_functions text[] := array[
    'public.create_merchant_business(text,text,text,text,text)',
    'public.update_merchant_business_profile(uuid,text,text,text,text,text)',
    'public.submit_merchant_business_for_review(uuid)',
    'public.admin_review_merchant_business(uuid,text,text)',
    'public.get_merchant_business_members(uuid)',
    'public.invite_merchant_member_by_email(uuid,text,text)',
    'public.revoke_merchant_business_member(uuid,uuid)',
    'public.add_merchant_location(uuid,text,text,text,text,text,jsonb)',
    'public.update_merchant_location(uuid,uuid,text,text,text,text,text,jsonb,boolean)',
    'public.accept_merchant_invitation(uuid)',
    'public.save_merchant_offer(uuid,uuid,text,text,text,timestamptz,timestamptz,text,integer,text,text)',
    'public.submit_merchant_offer_for_review(uuid)',
    'public.admin_review_merchant_offer(uuid,text,text)',
    'public.get_my_account_access_snapshot()',
    'private.has_merchant_business_access(uuid,text[])',
    'private.has_merchant_business_invitation(uuid)'
  ];
  v_required_function text;
begin
  foreach v_table in array v_required_tables loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Merchant Partner preflight failed: missing table public.%', v_table;
    end if;
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity is true
    ) then
      raise exception 'Merchant Partner preflight failed: RLS is not enabled on public.%', v_table;
    end if;
  end loop;

  foreach v_required_function in array v_required_functions loop
    if to_regprocedure(v_required_function) is null then
      raise exception 'Merchant Partner preflight failed: missing function %', v_required_function;
    end if;
  end loop;

  -- Public directory may read only explicitly approved offer fields.
  if not has_column_privilege('anon','public.merchant_offers','eligibility','SELECT')
     or not has_column_privilege('anon','public.merchant_offers','quota','SELECT')
     or not has_column_privilege('anon','public.merchant_offers','funded_by','SELECT') then
    raise exception 'Merchant Partner preflight failed: public offer detail column grants are incomplete';
  end if;
  if has_column_privilege('anon','public.merchant_offers','reviewed_by','SELECT') then
    raise exception 'Merchant Partner preflight failed: internal offer reviewer identity is publicly selectable';
  end if;

  -- Raw membership table reads are restricted to the caller's own limited fields.
  if not has_column_privilege('authenticated','public.merchant_memberships','user_id','SELECT')
     or not has_column_privilege('authenticated','public.merchant_memberships','membership_status','SELECT') then
    raise exception 'Merchant Partner preflight failed: own membership lookup columns are not selectable';
  end if;
  if has_column_privilege('authenticated','public.merchant_memberships','member_role','SELECT')
     or has_column_privilege('authenticated','public.merchant_memberships','invited_by','SELECT')
     or has_column_privilege('authenticated','public.merchant_memberships','accepted_at','SELECT') then
    raise exception 'Merchant Partner preflight failed: raw membership exposes private roster columns';
  end if;

  if has_column_privilege('anon','public.merchant_businesses','owner_user_id','SELECT') then
    raise exception 'Merchant Partner preflight failed: owner_user_id is publicly selectable';
  end if;
  if has_column_privilege('authenticated','public.merchant_offer_history','actor_user_id','SELECT') then
    raise exception 'Merchant Partner preflight failed: offer history exposes actor_user_id';
  end if;

  -- Client table mutations must go through scoped SECURITY DEFINER RPCs.
  if has_table_privilege('authenticated','public.merchant_businesses','INSERT')
     or has_table_privilege('authenticated','public.merchant_businesses','UPDATE')
     or has_table_privilege('authenticated','public.merchant_businesses','DELETE')
     or has_table_privilege('authenticated','public.merchant_memberships','INSERT')
     or has_table_privilege('authenticated','public.merchant_memberships','UPDATE')
     or has_table_privilege('authenticated','public.merchant_memberships','DELETE')
     or has_table_privilege('authenticated','public.merchant_locations','INSERT')
     or has_table_privilege('authenticated','public.merchant_locations','UPDATE')
     or has_table_privilege('authenticated','public.merchant_locations','DELETE')
     or has_table_privilege('authenticated','public.merchant_offers','INSERT')
     or has_table_privilege('authenticated','public.merchant_offers','UPDATE')
     or has_table_privilege('authenticated','public.merchant_offers','DELETE') then
    raise exception 'Merchant Partner preflight failed: authenticated clients have direct table mutation privileges';
  end if;

  -- Public and anonymous clients must not execute privileged mutation/review RPCs.
  if has_function_privilege('anon','public.create_merchant_business(text,text,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.update_merchant_business_profile(uuid,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.admin_review_merchant_business(uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.save_merchant_offer(uuid,uuid,text,text,text,timestamptz,timestamptz,text,integer,text,text)','EXECUTE')
     or has_function_privilege('anon','public.admin_review_merchant_offer(uuid,text,text)','EXECUTE') then
    raise exception 'Merchant Partner preflight failed: anon can execute a privileged Merchant Partner RPC';
  end if;
  if has_function_privilege('authenticated','public.invite_merchant_member(uuid,uuid,text)','EXECUTE') then
    raise exception 'Merchant Partner preflight failed: legacy unaudited UUID invitation RPC is still executable';
  end if;

  raise notice 'Merchant Partner staging preflight passed. Continue with role/JWT, cross-tenant, concurrency, notification, and UI acceptance tests.';
end;
$preflight$;
