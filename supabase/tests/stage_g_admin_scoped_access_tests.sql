-- STAGING ONLY: scoped Admin access and Admin-management regression checks.
-- Run as postgres/service-role SQL editor. All temporary account changes are rolled back.
begin;

-- Use the bootstrapped Super Admin identity as a temporary test principal.
update private.admin_accounts
set admin_level='admin',is_active=true,updated_at=now()
where user_id='fe426047-00a9-453b-8cc7-1648343a0340';
delete from private.admin_permissions
where admin_user_id='fe426047-00a9-453b-8cc7-1648343a0340';
insert into private.admin_permissions(admin_user_id,permission_key,granted_by)
values ('fe426047-00a9-453b-8cc7-1648343a0340','talent','fe426047-00a9-453b-8cc7-1648343a0340');

select set_config('request.jwt.claim.sub','fe426047-00a9-453b-8cc7-1648343a0340',true);
set local role authenticated;

-- Expected: Talent true; Booking/Finance/Support/Super Admin false.
select public.get_admin_access();
select public.has_admin_permission('talent') as talent_allowed,
       public.has_admin_permission('booking') as booking_denied,
       public.has_admin_permission('finance') as finance_denied,
       public.has_admin_permission('support') as support_denied,
       public.is_super_admin() as super_admin_denied;

-- Expected: direct booking table is empty for this Admin; safe RPC returns
-- operational columns only and is denied if the Booking permission is absent.
select count(*) as direct_booking_rows from public.bookings;
-- Expected to raise an authorization error for a Talent-only Admin:
-- select * from public.get_admin_bookings();

-- Expected: only Talent KTP objects can be seen; Customer KTP object is hidden.
select count(*) as visible_talent_ktp_objects
from storage.objects
where bucket_id='ktp-documents'
  and public.can_admin_access_ktp(((storage.foldername(name))[1])::uuid);

reset role;

-- Switch test principal to Finance only.
delete from private.admin_permissions
where admin_user_id='fe426047-00a9-453b-8cc7-1648343a0340';
insert into private.admin_permissions(admin_user_id,permission_key,granted_by)
values ('fe426047-00a9-453b-8cc7-1648343a0340','finance','fe426047-00a9-453b-8cc7-1648343a0340');
set local role authenticated;

select count(*) as finance_visible_payout_rows from public.payout_requests;
select count(*) as finance_direct_booking_rows from public.bookings;
-- Expected to return only requested booking labels/statuses, not money columns.
select * from public.get_admin_finance_booking_labels(
  array['6e1af1c8-9c39-49e6-ba07-a74d7bb43c44'::uuid]
);
select * from public.get_admin_finance_booking_statuses(
  array['6e1af1c8-9c39-49e6-ba07-a74d7bb43c44'::uuid]
);

reset role;

-- Switch test principal to Support only.
delete from private.admin_permissions
where admin_user_id='fe426047-00a9-453b-8cc7-1648343a0340';
insert into private.admin_permissions(admin_user_id,permission_key,granted_by)
values ('fe426047-00a9-453b-8cc7-1648343a0340','support','fe426047-00a9-453b-8cc7-1648343a0340');
set local role authenticated;

select count(*) as support_visible_report_rows from public.reports_complaints;
select count(*) as support_visible_customer_ktp_objects
from storage.objects
where bucket_id='ktp-documents'
  and public.can_admin_access_ktp(((storage.foldername(name))[1])::uuid);

reset role;

-- Restore all persistent state.
rollback;
