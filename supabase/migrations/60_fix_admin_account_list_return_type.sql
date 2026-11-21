drop function public.list_admin_accounts();
create function public.list_admin_accounts()
returns table(user_id uuid,email varchar,admin_level text,is_active boolean,permissions text[],created_at timestamptz,created_by uuid,updated_at timestamptz)
language plpgsql stable security definer set search_path to ''
as $function$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'Akses ditolak: hanya Super Admin yang dapat mengelola akun Admin.'; end if;
 return query select a.user_id,u.email,a.admin_level,a.is_active,
  coalesce(array_agg(p.permission_key order by p.permission_key) filter(where p.permission_key is not null),array[]::text[]),
  a.created_at,a.created_by,a.updated_at
 from private.admin_accounts a left join public.users u on u.id=a.user_id
 left join private.admin_permissions p on p.admin_user_id=a.user_id
 group by a.user_id,u.email,a.admin_level,a.is_active,a.created_at,a.created_by,a.updated_at
 order by (a.admin_level='super_admin') desc,a.created_at asc;
end;
$function$;
revoke all on function public.list_admin_accounts() from public,anon;
grant execute on function public.list_admin_accounts() to authenticated;
