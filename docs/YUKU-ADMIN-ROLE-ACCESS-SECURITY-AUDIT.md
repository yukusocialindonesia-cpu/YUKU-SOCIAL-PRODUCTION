# YUKU Admin Role & Access Security Audit

Tanggal: 26 November 2026  
Branch: `feat/professional-services-categories`  
Scope: Admin permission registry, RLS, SECURITY DEFINER RPC guards, KTP review, account management, booking triggers and audit trail.

## Executive decision

The scoped Admin model is directionally sound: permissions are stored in a private schema; Super Admin alone provisions Admins and changes their permissions; Finance, Support, Talent and Booking have separate RPC/RLS scopes; public booking reads do not expose financial snapshots to Booking Admin.

**Do not treat the role model as production-ready until the trigger bypasses and remaining generic Admin RPCs are fully reconciled and negative permission tests pass in Staging.** The SQL source contains a broad bypass for scoped Admins in booking triggers. Current RLS limits direct table access, but the bypass is still an unsafe integrity boundary for SECURITY DEFINER functions and future RPCs.

## Role boundaries found in source

| Role / permission | Intended access |
|---|---|
| Super Admin | Full Admin control, Admin account provisioning and permissions, site-wide configuration |
| Talent | Talent profiles/services/media and Talent KTP/document review |
| Booking | Minimal booking operations through `get_admin_bookings()`; no payment/financial columns |
| Finance | Payments, refunds, payout, QRIS, affiliate and financial reporting through scoped RLS/RPCs |
| Support | Reports/complaints, Customer KTP review and limited customer/talent summaries |

## Controls already present

1. Migrations 48 creates `private.admin_accounts` and `private.admin_permissions`; permission keys are constrained to talent/booking/finance/support. Direct table access is revoked from PUBLIC, anon, authenticated and service_role.
2. Private helper functions resolve only the current authenticated user's active Admin/permissions. Public RPCs `get_admin_access()`, `has_admin_permission(text)`, and `is_super_admin()` derive identity from `auth.uid()`, not a caller-supplied subject.
3. Migration 49 scopes Talent, Finance and Support RLS policies. Site branding, promotions, hero slides and activity taxonomy remain Super Admin-only.
4. Migration 51 narrows key Admin RPCs: payout/refund/cancellation resolution to Finance; report resolution to Support; Talent review and identity changes to Talent; dashboard overview to Super Admin.
5. Migration 52 routes Talent KTP review to Talent permission and Customer KTP review to Support permission.
6. Migrations 54/55/56 provide purpose-built minimal Admin read RPCs. Booking Admin receives a limited activity-shaped booking result without gross amount, commission or payment data. Finance receives purpose-built customer/Talent labels; Support receives report-linked booking summaries.
7. Migration 59 makes Admin account listing, permission changes and activation Super Admin-only; provisioning requires service_role and validates an active Super Admin inviter. Permission changes and account status changes are audit logged.
8. Migration 61 revokes anon execution of `is_admin()`. Migration 62 redefines generic `is_admin()` to mean service_role or Super Admin, not every scoped Admin.
9. Migration 62 protects user role/security columns and requires the appropriate KTP permission for KTP-derived verification/status changes.

## Findings and release gates

### P0 — Scoped Admin bypass in booking integrity triggers

Migration 62 currently returns early from both `guard_booking_status_actor()` and `validate_booking_update()` when the caller has any of the Booking, Finance or Support permissions.

This means the trigger layer does not enforce field immutability or status-actor validation for those roles. Current bookings RLS policy is narrower and allows direct updates only to booking parties or Super Admin, which reduces immediate exposure. However, any SECURITY DEFINER RPC that updates bookings while running under a scoped Admin identity can pass through these broad trigger bypasses. The bypass also creates a dangerous default for future RPCs.

Required correction:
- Remove the blanket Booking/Finance/Support early return.
- Permit only explicitly approved transitions by module:
  - Finance: refund-related transition only after processed refund evidence and amount checks.
  - Support: disputed_hold / restore only through the report-resolution RPC and only when report state and `status_before_dispute` match.
  - Booking: no direct financial/status mutation; use explicit guarded booking operations.
- Keep immutable financial/participant snapshots enforced for every scoped Admin.
- Add negative tests proving Finance cannot alter service/schedule/status snapshots, Support cannot alter payment/commission/payout fields, and Booking cannot alter money or dispute/refund outcomes.

No trigger change was committed in this audit because the valid transition set must be aligned with all existing SECURITY DEFINER RPCs and tested as one migration; a broad replacement without that compatibility pass could break report resolution or refund processing.

### P0 — Audit every SECURITY DEFINER RPC still using generic `is_admin()`

Migration 62 changes `public.is_admin()` to Super Admin/service_role only. This is a safer default, but legacy functions that still use `is_admin()` may now become Super Admin-only even if their UI is visible to scoped Admins. Conversely, any RPC that was rewritten to `has_admin_permission()` must be checked for field-level scope and caller identity.

Required inventory/test:
- Enumerate every SECURITY DEFINER function containing `is_admin()`, `has_admin_permission()`, or role checks.
- Classify each by module and exact read/write columns.
- Confirm no generic helper returns broad personal/financial data to a lower-privilege role.
- Confirm RPCs reject null `auth.uid()` and derive the target user/booking from server-side ownership or a permission-checked ID.
- Test all signatures, overloads and grants after the full migration chain.

### P1 — KTP permission and user status coupling

Migration 52 correctly splits Customer KTP review (Support) from Talent KTP review (Talent). Migration 62 also protects KTP-derived `is_verified_18` and `account_status` using `can_admin_access_ktp(target_user_id)`.

Verify in Staging:
- Talent permission cannot review Customer KTP.
- Support permission cannot review Talent KTP.
- A reviewer cannot directly modify identity evidence or forge `verified_by_admin_id` / verification timestamps.
- Only approved KTP decisions change age/account status; account suspension/ban workflows remain separately authorized.
- KTP RPC locks the identity row and accepts only pending_review decisions.

### P1 — Booking read model is legacy-shaped

`get_admin_bookings()` returns `booking_mode`, `start_time`, `duration_hours`, `meeting_location_name`. It omits professional service snapshots because the shared booking contract is not implemented. Keep it as a legacy compatibility RPC; introduce a versioned, kind-aware Admin read RPC when professional bookings are enabled. Do not widen it to expose financial columns.

### P1 — Admin account self-protection and recovery

Migration 59 prevents the primary Super Admin from changing its own permissions or deactivating itself. It does not, by itself, establish a documented recovery process if the owner loses access or a second Super Admin is needed.

Product/security decision required:
- Decide whether multiple Super Admins are allowed.
- Define a controlled recovery process with out-of-band verification and immutable audit.
- Avoid self-service escalation from scoped Admin to Super Admin.

### P1 — Sensitive data and RPC minimization

The purpose-built label/summary RPCs are preferable to broad `users` or booking table reads. Verify output columns and array-size limits, especially for email, full name, customer labels and report summaries. Support should not receive bank details or financial balances; Finance should not receive KTP images unless a documented task requires it; Booking should not receive full customer identity records.

### P2 — Audit log integrity and coverage

Permission and Admin activation changes are logged. Verify audit coverage for:
- payout/refund decision and provider reference;
- KTP approval/rejection;
- report moderation and dispute resolution;
- Talent application/document review;
- Admin permission changes and account activation;
- failed privileged attempts and access denials.

Logs must be append-only to Admin clients, actor IDs must be server-derived, and sensitive evidence/credentials must not be copied into JSON audit payloads.

## Required Staging negative-permission matrix

- Anonymous: cannot execute Admin helpers/RPCs or read private Admin tables.
- Customer/Talent: cannot call Admin RPCs, change roles, KTP decisions, payout status or financial snapshots.
- Talent Admin: can review Talent applications/KTP and edit permitted Talent data; cannot process refunds/payouts, Customer KTP or reports.
- Booking Admin: can read minimal booking operational fields; cannot read/edit gross amount, platform fee, payout or payment proofs; cannot resolve refunds or KTP.
- Finance Admin: can read/process Finance data and payout/refund through guarded RPCs; cannot review KTP, edit Talent verification, moderate reports, or alter booking scope/schedule.
- Support Admin: can review reports and Customer KTP; cannot view bank details, process payout/refund, change commission, or review Talent credentials unless separately granted Talent.
- Super Admin: can perform approved global administration; all sensitive actions audited.
- Disabled Admin: all scoped permissions immediately ineffective, including cached UI sessions and SECURITY DEFINER RPC calls.

## Validation boundary

This is a source-level audit of the feature branch. No SQL was executed, no Staging/Production data was modified, and no database policies were deployed. Negative permission tests and migration replay remain mandatory before release.


## Follow-up implementation — narrowed booking trigger bypass

Commit: `649299c04c659b07b343912ecc77aa44464ad924`  
Migration: `supabase/migrations/20261127000500_narrow_scoped_admin_booking_trigger_bypass.sql`

Implemented on the feature branch:
- Removed Booking, Finance and Support permission-based blanket early returns from both booking trigger guards.
- Financial amount snapshots, participant IDs and activity category relationship are now checked for scoped Admin updates too.
- Added a narrow Support-only exception to place a booking in `disputed_hold` only when a related report remains open/investigating and the prior status snapshot is preserved.
- Added a narrow Support-only restoration exception: the booking must return to the exact recorded pre-dispute status, clear the snapshot, and have no remaining active reports.
- Prevented standalone edits to `status_before_dispute`.
- Preserved trusted service-role/database operations and nested trigger cascades.

Static source checks after commit confirmed the blanket permission bypass pattern is absent, the narrow Support hold/restore branches exist, financial snapshot protection remains present, and the disputed-hold restoration transition is guarded.

**Not yet verified:** PostgreSQL migration replay, RPC integration, trigger execution order, and negative permission tests in Staging. In particular, test both the report-insert auto-hold trigger and Support report-resolution restore path with one and multiple active reports before production rollout. No Staging or Production database was modified.


## Admin UI follow-up — booking status display

Commit: `e4ccbf2e067e889be53f4609ecb0a198ce804827`

- Confirmed scoped Booking Admin already uses the minimal `get_admin_bookings()` RPC; the direct `bookings.select('*')` path is inside the explicit Super Admin branch only. The earlier source review's broad concern about all Admins using direct table access was too broad.
- Fixed the actual UI defect: mobile and desktop Booking tabs compared legacy status strings (`confirmed`, `cancelled`) that are not members of the current booking status enum. Most paid/confirmed/in-progress/disputed/refunded/expired bookings were therefore mislabeled as awaiting payment.
- Both layouts now render labels for the actual lifecycle states: pending_payment, paid_held_in_escrow, confirmed_by_talent, in_progress, completed, disputed_hold, cancelled_by_customer, cancelled_by_talent, refunded and expired.
- Source was re-fetched after commit: old status comparisons are absent, all current lifecycle states are represented, scoped Admin RPC use remains present, and direct full-row booking access remains Super Admin-only.

No application build or browser test has been run yet.

## Follow-up implementation — scoped Admin summary RPCs

Commit: `b2b6a25802ad94ebd99da1ad605150b82af42bd2`  
Migration: `supabase/migrations/20261127000600_scope_admin_summary_rpcs.sql`

Source-level finding:
- `get_admin_user_summaries(uuid[])` previously accepted caller-supplied IDs and returned email, full name, account status, age-verification flag and role for any Customer/Talent when called by Support, or any Talent when called by Talent Admin. The UI supplied legitimate IDs, but the SECURITY DEFINER boundary itself did not enforce those record relationships.
- `get_admin_report_booking_summaries(uuid[])` accepted arbitrary booking IDs from Support and returned booking code/status without requiring a linked report.

Implemented on the feature branch:
- Talent Admin summaries are restricted to IDs backed by `talent_profiles` and the Talent role.
- Support summaries are restricted to Customer identity records or users who are reporter/reported party in `reports_complaints`; the role remains limited to Customer/Talent.
- Support booking summaries now require a booking linked to at least one report.
- Existing function signatures and returned columns are preserved for current AdminPage callers; anon/PUBLIC execute remains revoked and authenticated execute remains granted.

Static review confirms the current AdminPage call sites pass IDs from the corresponding Talent, Customer identity, and report datasets, so the narrowed conditions preserve the intended UI use. PostgreSQL replay and authenticated role-matrix tests have not been run. No Staging/Production database was modified.
