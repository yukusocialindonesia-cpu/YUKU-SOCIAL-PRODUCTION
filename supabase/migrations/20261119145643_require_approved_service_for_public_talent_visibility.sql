create or replace function public.is_talent_publicly_visible(p_talent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.users u
    join public.user_identities ui on ui.id = u.id
    join public.talent_profiles tp on tp.id = u.id
    where u.id = p_talent_id
      and u.role = 'talent'::public.user_role_type
      and u.account_status = 'active'::public.account_status_type
      and u.is_verified_18 is true
      and ui.ktp_verification_status = 'verified'::public.ktp_status_type
      and tp.is_approved is true
      and exists (
        select 1
        from public.talent_services ts
        where ts.talent_id = p_talent_id
          and ts.approval_status = 'approved'
          and ts.is_active is true
      )
  );
$function$;