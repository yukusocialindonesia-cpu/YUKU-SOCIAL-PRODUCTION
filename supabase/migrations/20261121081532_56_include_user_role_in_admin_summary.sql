drop function public.get_admin_user_summaries(uuid[]);
create function public.get_admin_user_summaries(p_user_ids uuid[])
returns table(id uuid,email varchar,full_name varchar,account_status public.account_status_type,is_verified_18 boolean,role public.user_role_type)
language plpgsql stable security definer set search_path to ''
as $function$
begin
 if auth.uid() is null or not (public.is_super_admin() or public.has_admin_permission('talent') or public.has_admin_permission('support')) then
  raise exception 'Akses ditolak: izin Talent atau Support diperlukan.';
 end if;
 return query select u.id,u.email,u.full_name,u.account_status,u.is_verified_18,u.role
 from public.users u where u.id=any(coalesce(p_user_ids,array[]::uuid[]))
 and (public.is_super_admin() or (public.has_admin_permission('talent') and u.role='talent'::public.user_role_type)
  or (public.has_admin_permission('support') and u.role in ('customer'::public.user_role_type,'talent'::public.user_role_type)));
end;
$function$;
revoke all on function public.get_admin_user_summaries(uuid[]) from public,anon;
grant execute on function public.get_admin_user_summaries(uuid[]) to authenticated;

