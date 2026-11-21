-- Provision a newly invited scoped Admin and all of its permissions atomically.
-- This RPC is backend-only: the Edge Function must call it with the service-role key.

create or replace function public.provision_scoped_admin_account_with_permissions(
  p_user_id uuid,
  p_created_by uuid,
  p_permissions text[]
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old_role public.user_role_type;
  v_permissions text[];
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Akses ditolak: endpoint provisioning hanya untuk backend tepercaya.';
  end if;

  if p_user_id is null or p_created_by is null then
    raise exception 'Identitas akun Admin tidak valid.';
  end if;

  if not private.is_super_admin(p_created_by) then
    raise exception 'Pemberi undangan bukan Super Admin aktif.';
  end if;

  v_permissions := coalesce(p_permissions, array[]::text[]);
  if cardinality(v_permissions) = 0
     or array_position(v_permissions, null) is not null
     or exists (
       select 1
       from unnest(v_permissions) as requested(permission_key)
       where requested.permission_key not in ('talent', 'booking', 'finance', 'support')
     ) then
    raise exception 'Daftar izin Admin tidak valid.';
  end if;

  select u.role
    into v_old_role
  from public.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception 'Profil pengguna belum dibuat oleh proses undangan.';
  end if;

  if exists (
    select 1
    from private.admin_accounts a
    where a.user_id = p_user_id
      and a.admin_level = 'super_admin'
  ) then
    raise exception 'Akun Super Admin tidak dapat diubah menjadi Admin biasa.';
  end if;

  update public.users
  set role = 'admin'::public.user_role_type,
      updated_at = now()
  where id = p_user_id;

  insert into private.admin_accounts (
    user_id, admin_level, is_active, created_by, updated_at
  )
  values (p_user_id, 'admin', true, p_created_by, now())
  on conflict (user_id) do update
    set admin_level = 'admin',
        is_active = true,
        created_by = excluded.created_by,
        updated_at = now();

  delete from private.admin_permissions
  where admin_user_id = p_user_id;

  insert into private.admin_permissions (
    admin_user_id, permission_key, granted_by
  )
  select p_user_id, requested.permission_key, p_created_by
  from (
    select distinct unnest(v_permissions) as permission_key
  ) as requested;

  insert into public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  )
  values (
    p_created_by,
    'admin_account_invited',
    'private.admin_accounts',
    p_user_id::text,
    jsonb_build_object('previous_public_role', v_old_role),
    jsonb_build_object(
      'admin_level', 'admin',
      'is_active', true,
      'permissions', (select coalesce(jsonb_agg(p.permission_key order by p.permission_key), '[]'::jsonb)
                     from private.admin_permissions p where p.admin_user_id = p_user_id)
    )
  );

  return true;
end;
$function$;

revoke all on function public.provision_scoped_admin_account_with_permissions(uuid, uuid, text[])
  from public, anon, authenticated;
grant execute on function public.provision_scoped_admin_account_with_permissions(uuid, uuid, text[])
  to service_role;
