-- STAGING ONLY: Super Admin account-management and provisioning tests.
-- Uses an existing Talent row temporarily; all database changes are rolled back.
begin;

insert into private.admin_accounts(user_id,admin_level,is_active,created_by)
values ('f77a9a72-609a-42c2-b5d0-de89ed2b55d8','admin',true,'fe426047-00a9-453b-8cc7-1648343a0340')
on conflict(user_id) do update set admin_level='admin',is_active=true;

select set_config('request.jwt.claim.sub','fe426047-00a9-453b-8cc7-1648343a0340',true);
set local role authenticated;

-- Expected: Super Admin can list accounts and assign multiple permissions.
select * from public.list_admin_accounts();
select public.set_admin_permissions(
  'f77a9a72-609a-42c2-b5d0-de89ed2b55d8'::uuid,
  array['talent','finance']::text[]
);
select public.set_admin_active('f77a9a72-609a-42c2-b5d0-de89ed2b55d8'::uuid,false);

reset role;
select set_config('request.jwt.claim.sub','f77a9a72-609a-42c2-b5d0-de89ed2b55d8',true);

-- Expected: inactive Admin has no access and no permissions.
select public.get_admin_access();

-- Provisioning is service-role-only. It updates only the role/admin account,
-- not account_status or is_verified_18.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.provision_scoped_admin_account(
  'f77a9a72-609a-42c2-b5d0-de89ed2b55d8'::uuid,
  'fe426047-00a9-453b-8cc7-1648343a0340'::uuid
);
select role,account_status,is_verified_18
from public.users
where id='f77a9a72-609a-42c2-b5d0-de89ed2b55d8';

rollback;
