create or replace function public.list_admin_accounts()
returns table(user_id uuid,email varchar,admin_level varchar,is_active boolean,permissions text[],created_at timestamptz,created_by uuid,updated_at timestamptz)
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

create or replace function public.set_admin_permissions(p_admin_user_id uuid,p_permissions text[])
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare v_old_permissions text[];
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'Akses ditolak: hanya Super Admin yang dapat mengatur izin.'; end if;
 if p_admin_user_id=auth.uid() then raise exception 'Izin Super Admin utama tidak dapat diubah dari menu ini.'; end if;
 if not exists(select 1 from private.admin_accounts a where a.user_id=p_admin_user_id and a.admin_level='admin' and a.is_active=true) then
  raise exception 'Akun Admin tidak ditemukan atau sedang dinonaktifkan.';
 end if;
 if exists(select 1 from unnest(coalesce(p_permissions,array[]::text[])) p where p not in ('talent','booking','finance','support')) then
  raise exception 'Daftar izin tidak valid.';
 end if;
 select coalesce(array_agg(permission_key order by permission_key),array[]::text[]) into v_old_permissions
 from private.admin_permissions where admin_user_id=p_admin_user_id;
 delete from private.admin_permissions where admin_user_id=p_admin_user_id;
 insert into private.admin_permissions(admin_user_id,permission_key,granted_by)
 select p_admin_user_id,p.permission_key,auth.uid()
 from (select distinct unnest(coalesce(p_permissions,array[]::text[])) as permission_key) p;
 insert into public.admin_audit_logs(admin_user_id,action_type,target_table,target_id,old_data,new_data)
 values(auth.uid(),'admin_permissions_updated','private.admin_accounts',p_admin_user_id::text,
 jsonb_build_object('permissions',v_old_permissions),jsonb_build_object('permissions',coalesce(p_permissions,array[]::text[])));
 return true;
end;
$function$;

create or replace function public.set_admin_active(p_admin_user_id uuid,p_is_active boolean)
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare v_old_active boolean;
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'Akses ditolak: hanya Super Admin yang dapat mengubah status akun Admin.'; end if;
 if p_admin_user_id=auth.uid() then raise exception 'Super Admin utama tidak dapat menonaktifkan dirinya sendiri.'; end if;
 select a.is_active into v_old_active from private.admin_accounts a
 where a.user_id=p_admin_user_id and a.admin_level='admin' for update;
 if not found then raise exception 'Akun Admin tidak ditemukan.'; end if;
 update private.admin_accounts set is_active=p_is_active,updated_at=now() where user_id=p_admin_user_id;
 insert into public.admin_audit_logs(admin_user_id,action_type,target_table,target_id,old_data,new_data)
 values(auth.uid(),'admin_account_status_updated','private.admin_accounts',p_admin_user_id::text,
 jsonb_build_object('is_active',v_old_active),jsonb_build_object('is_active',p_is_active));
 return true;
end;
$function$;

create or replace function public.provision_scoped_admin_account(p_user_id uuid,p_created_by uuid)
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare v_old_role public.user_role_type;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Akses ditolak: endpoint provisioning hanya untuk backend tepercaya.'; end if;
 if not private.is_super_admin(p_created_by) then raise exception 'Pemberi undangan bukan Super Admin aktif.'; end if;
 select u.role into v_old_role from public.users u where u.id=p_user_id for update;
 if not found then raise exception 'Profil pengguna belum dibuat oleh proses undangan.'; end if;
 if exists(select 1 from private.admin_accounts a where a.user_id=p_user_id and a.admin_level='super_admin') then
  raise exception 'Akun Super Admin tidak dapat diubah menjadi Admin biasa.';
 end if;
 update public.users set role='admin'::public.user_role_type,updated_at=now() where id=p_user_id;
 insert into private.admin_accounts(user_id,admin_level,is_active,created_by,updated_at)
 values(p_user_id,'admin',true,p_created_by,now())
 on conflict(user_id) do update set admin_level='admin',is_active=true,created_by=excluded.created_by,updated_at=now();
 insert into public.admin_audit_logs(admin_user_id,action_type,target_table,target_id,old_data,new_data)
 values(p_created_by,'admin_account_invited','private.admin_accounts',p_user_id::text,
 jsonb_build_object('previous_public_role',v_old_role),jsonb_build_object('admin_level','admin','is_active',true));
 return true;
end;
$function$;

revoke all on function public.list_admin_accounts() from public,anon;
revoke all on function public.set_admin_permissions(uuid,text[]) from public,anon;
revoke all on function public.set_admin_active(uuid,boolean) from public,anon;
revoke all on function public.provision_scoped_admin_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_admin_accounts() to authenticated;
grant execute on function public.set_admin_permissions(uuid,text[]) to authenticated;
grant execute on function public.set_admin_active(uuid,boolean) to authenticated;
grant execute on function public.provision_scoped_admin_account(uuid,uuid) to service_role;

