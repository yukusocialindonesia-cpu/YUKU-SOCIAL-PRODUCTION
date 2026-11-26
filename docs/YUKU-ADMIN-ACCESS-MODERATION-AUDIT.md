# YUKU Admin Access & Moderation Audit

Date: 2026-11-26
Branch: `feat/professional-services-categories`
Production scope: read-only catalog, function definition, RLS and privilege inspection. No user or financial rows were read.

## Executive summary

The current Admin model is permission-scoped in its core helpers:
- `private.is_active_admin(user_id)` requires an active Admin account and an active `public.users` account.
- `private.has_admin_permission(user_id, permission)` accepts only the four known modules and grants Super Admin all modules; otherwise it requires an explicit permission row.
- `public.is_admin()` is Super Admin-only for authenticated callers (the service-role claim is also accepted for trusted backend operations).
- `public.get_admin_access()` derives the UI permission payload from the database, not editable user metadata.

Most inspected Admin RPCs enforce the expected module permission and use `SECURITY DEFINER SET search_path TO ''`. Finance, Support, Talent and Booking read/action RPCs inspected were scoped to their respective permissions. Admin account listing and permission-management RPCs are Super Admin-only and prevent self-deactivation/self-permission edits of the primary Super Admin.

## Confirmed Production finding — P1 report moderation direct-write bypass

Production still grants the `authenticated` role column-level UPDATE on:
- `public.reports_complaints.status`
- `public.reports_complaints.admin_notes`
- `public.reports_complaints.resolved_by_admin_id`

The table has RLS enabled and its UPDATE policy permits users with `has_admin_permission('support')`. Therefore a Support Admin can update moderation fields directly through the Data API, bypassing `admin_resolve_report()` row locking, validation and its `admin_audit_logs` insert. This is a confirmed database privilege gap, not just a UI concern.

The intended path is the `admin_resolve_report(uuid, report_status_type, text, boolean)` SECURITY DEFINER RPC. Its current Production definition checks Support permission, locks the report row, applies the booking dispute/hold transition, and writes an audit-log record.

**Required fix:** create a new forward migration using `supabase migration new` that revokes direct UPDATE on the three moderation columns from `authenticated` (and any other exposed role that has it), while retaining the RPC owner path. Do not edit an already-applied migration. Then verify effective column privileges and run negative tests proving direct UPDATE fails while the Support RPC succeeds and produces an audit log. This audit did not create or apply that migration.

## Other Admin access checks

### Authentication and account lifecycle
- The UI obtains Admin access through `get_admin_access()`; failed lookup returns no Admin access.
- The AuthContext reloads role/access on user changes and when the app regains focus.
- Suspended/banned accounts are signed out; only active or pending-verification accounts pass the general account gate. Sensitive Admin operations still require an active Admin account through the database helper.
- `private.is_active_admin` checks both `admin_accounts.is_active` and `users.account_status='active'`, so deactivation/account suspension invalidates permission checks on subsequent requests.

### Module RPCs
- Finance: payout, refund, cancellation-case resolution, bank-transfer review and QRIS Finance wrapper require Finance permission.
- Support: report resolution and report-to-booking summary RPCs require Support permission.
- Talent: Talent curation, KTP routing, media moderation and private profile summary RPCs require Talent permission or the documented Super Admin exception.
- Booking: booking list RPC requires Booking permission.
- Admin account management: list, activate/deactivate and permission changes require Super Admin. The management RPCs reject self-targeting for the primary Super Admin.
- The legacy `admin_review_talent_profile` and `admin_set_payment_checkout_enabled` use `public.is_admin()`, which currently resolves to Super Admin (plus trusted service-role execution). These are therefore Super Admin-only, not general module Admin endpoints. Keep the UI and documentation aligned with that intent.

### RLS and data boundaries
- `admin_audit_logs` has RLS enabled and its read policy is Super Admin-only.
- `bookings` direct SELECT is limited to booking participants and Super Admin; Booking Admin uses the scoped list RPC.
- `payments` and `refunds` reads are participant/Finance scoped.
- `payout_requests` reads are Talent/Finance scoped; direct authenticated INSERT is revoked at table level in the current Production snapshot, and payout creation uses the validated RPC.
- `user_identities` reads are owner or role-routed through `can_admin_access_ktp`; Talent KTP and Customer KTP are routed to different permission modules.
- `users` direct reads are owner/Super Admin; module Admin summaries use a permission-scoped RPC.
- Sensitive Admin tables have RLS enabled in the inspected set.

## UI review
- `AdminPage` waits for AuthContext loading, rejects users without database-confirmed Admin access, and builds visible tabs from the permission payload.
- Data loading is split by module permissions; Super Admin receives the full module set.
- UI tab visibility is not treated as a security boundary; the RPC/RLS checks remain authoritative.
- The main Admin page still uses direct table reads for module queues where RLS and grants permit them. Keep each direct query restricted to the relevant module and avoid broad `select('*')` where a narrower projection is practical.

## Remaining verification / release gates

1. Generate and stage the report moderation column-privilege revocation migration.
2. Add automated negative tests for direct report UPDATE, cross-module RPC calls, inactive Admin accounts and self-admin-management.
3. Replay all branch migrations on a healthy Staging database; the currently listed preview branch was previously reported `MIGRATIONS_FAILED`.
4. Verify that every public SECURITY DEFINER function is either intentionally callable or explicitly revoked; this audit focused on Admin and moderation workflows, not the full public function inventory.
5. Verify realtime topic policies and Admin notification routing in live Staging; Production settings were not changed.
6. Run build, type checks and all relevant GitHub Actions after the code/migration changes.

## Change boundary

No Production DDL/DML, migration, RLS policy, grant, account, Admin permission, Edge Function, setting, deployment or PR merge was performed. This document records a read-only audit and the confirmed remediation requirement.
