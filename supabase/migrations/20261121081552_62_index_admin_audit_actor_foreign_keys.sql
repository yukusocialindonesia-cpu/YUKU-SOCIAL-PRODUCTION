create index if not exists admin_accounts_created_by_idx
on private.admin_accounts(created_by)
where created_by is not null;

create index if not exists admin_permissions_granted_by_idx
on private.admin_permissions(granted_by)
where granted_by is not null;
