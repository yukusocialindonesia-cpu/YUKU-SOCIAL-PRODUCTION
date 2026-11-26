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

Finance label RPC follow-up (same migration, commit `8c9ac61cb9c71f70bb1904e259d71df6eaf7c918`):
- `get_admin_talent_labels` now returns Talent labels only for Talent IDs that have payout requests.
- `get_admin_customer_labels` now returns Customer labels only for customers with refunds or cancellation cases.
- `get_admin_finance_booking_labels` now returns booking codes only for bookings linked to refunds or cancellation cases.
- Existing AdminPage callers already pass IDs from those respective datasets, so their intended use remains covered.

Validation remains source-level only; no PostgreSQL replay or Staging tests have been run.


## Follow-up: account recovery endpoint and Admin provisioning — 26 November 2026

### P2: backend previously accepted pending_verification -> active through the recovery endpoint

The account-management Edge Function is restricted to an authenticated, active Super Admin via get_admin_access(). The UI correctly exposes the Aktifkan action only for suspended accounts. However, the backend previously accepted status=active for any Customer/Talent account except one already banned, including pending_verification. That created a direct-API path to bypass the initial identity-verification state transition (even though booking and Talent public visibility still have separate identity checks).

Branch fix:
- supabase/functions/account-management/index.ts now permits a transition to active only when the current account_status is suspended.
- banned accounts remain non-reactivatable from this menu.
- pending_verification -> active through this recovery endpoint is rejected server-side.
- The normal KTP verification / Talent approval paths remain responsible for the initial pending_verification -> active transition.

Static source validation: the new guard is placed after the target row is loaded and before the database status update. No deployed Edge Function was changed. The deployed Production account-management function remains version 1 and is still the pre-fix version until a separately approved deployment.

### P2: status database/Auth/audit operations are compensating, not atomic

The account-management function performs three separate steps: optimistic account_status update in Postgres, Auth ban_duration update, then admin_audit_logs insert. It attempts compensating rollback when Auth or audit writes fail. This is safer than a blind update, but the three systems are not one transaction.

A concurrent suspend/reactivate pair can interleave after the database compare-and-set but before the Auth update/audit write, potentially leaving Auth ban state inconsistent with public.users.account_status or recording two successful operations whose external effects finish out of order. Current read-only Production aggregate snapshot showed zero status/Auth mismatches for Customer/Talent accounts; that does not rule out a race under concurrent requests.

Recommended follow-up before relying on this as a high-assurance control:
1. Introduce an idempotent, per-user serialized status-operation workflow (operation ID + expected previous status + pending/completed/failed state).
2. Reconcile Auth ban state against the committed account status after each operation and through a periodic read-only mismatch monitor.
3. Make audit events identify the operation ID and final outcome; do not return success until the final state is confirmed.
4. Add Staging concurrency tests for suspend-vs-reactivate, duplicate request, Auth API failure, audit insert failure, and compensation failure.

### Production Admin role and provisioning read-only checks

- Production currently has 2 Admin profiles: 1 active Super Admin and 1 active scoped Admin; no Admin profile in this snapshot was inactive or suspended.
- get_admin_access() returns Admin access only when private.is_active_admin(auth.uid()) is true. That helper requires private.admin_accounts.is_active=true, public.users.role='admin', and account_status='active'.
- is_super_admin() additionally requires admin_level='super_admin'. Scoped permission checks require an active Admin and an allowlisted permission key (talent, booking, finance, support).
- provision_scoped_admin_account_with_permissions() is not executable by anon/authenticated; it requires service_role and verifies the supplied creator is an active Super Admin. It locks the target user, prevents converting an existing Super Admin to a scoped Admin, replaces the permission set transactionally, and writes an audit record.
- set_admin_permissions() requires an authenticated Super Admin, prevents self-editing the primary Super Admin permissions, and only targets an active scoped Admin.

No Production data, Admin permission, Auth ban state, Edge Function, migration, or account status was changed during this review.


## Admin permission revocation and existing sessions — Production read-only verification, 26 November 2026

### What happens when a scoped Admin is disabled or loses a permission

The effective Production functions were inspected directly:
- set_admin_active(uuid, boolean) is authenticated-only and requires public.is_super_admin(). It locks the target private.admin_accounts row, changes is_active, and writes an audit event in the same database transaction. It cannot target a Super Admin and the acting Super Admin cannot disable itself.
- set_admin_permissions(uuid, text[]) is authenticated-only and Super Admin-only. It rejects self-edit and invalid permission keys, replaces the target permission rows and writes an audit event in the same transaction.
- private.is_active_admin(uuid) checks the current database values: admin_accounts.is_active, public.users.role='admin', and public.users.account_status='active'.
- private.has_admin_permission(uuid,text) and private.is_super_admin(uuid) derive from the same live private records. The internal helper functions have no direct EXECUTE grants to anon/authenticated/service_role; the public get_admin_access() wrapper is authenticated-only.
- Production policy inventory: 43 policies reference the live Admin authorization helpers. Therefore a disabled Admin or removed permission loses access at the database authorization boundary on subsequent policy/RPC evaluation, even if their already-issued JWT has not yet expired.
- The admin-management Edge Function checks the current get_admin_access() result before inviting another Admin. It does not trust a stale UI permission flag.

### Existing Auth session is not proactively deleted

set_admin_active only changes the Admin authorization record; it does not revoke/delete rows in auth.sessions or invalidate the user's JWT. This is not equivalent to immediate global sign-out:
- Database RLS and guarded RPCs re-evaluate current Admin permission from the database, so the old JWT alone should not preserve Admin privileges for those paths.
- Authenticated identity/session may remain valid for non-Admin functionality permitted to that account.
- AuthContext refreshes role/Admin access on token refresh, USER_UPDATED and window focus. It does not receive a dedicated push event when another Super Admin changes this user's permissions, so the UI may show stale menu state until the next refresh/focus; server-side permission checks remain authoritative.
- A connected Realtime private channel may have a different reauthorization/disconnect lifecycle than a new database request. Immediate revocation of an already joined socket was not demonstrated in this read-only audit and needs a dedicated Staging test.

Production snapshot at audit time:
- Two Admin profiles exist: one active Super Admin and one active scoped Admin.
- No active auth.sessions rows were found for currently active Admin accounts in the queried snapshot; no disabled Admin sessions were found either. This is a point-in-time result, not proof that future sessions will be proactively revoked.
- No Admin permissions were found attached to a private Admin account that was inactive or whose public role/account status was not active.

### Recommendation / remaining hardening

1. Treat the database helper checks as the authorization boundary; never rely on hiding Admin menu items alone.
2. Add a revocation test with an active scoped Admin logged in on two clients: Super Admin removes one permission and disables the account; immediately attempt direct RPC, table/RLS read/write, Storage operation, Edge Function call, and existing Realtime channel activity from the still-open client.
3. Confirm that the old JWT can still authenticate ordinary allowed user functions but cannot access any Admin-scoped surface after revocation.
4. If policy requires immediate global session termination, implement a separate server-side session-revocation design and test it across browser tabs/mobile clients and Realtime sockets. Do not assume changing admin_accounts.is_active itself logs the user out.
5. Test concurrent permission changes and account disablement, including duplicate requests and audit-log outcomes.

Supabase Auth session documentation states that JWTs carry a session_id corresponding to auth.sessions, and that stronger post-sign-out guarantees can validate that session row. The current YUKU Admin authorization primarily uses live database permission helpers instead; it does not yet implement an explicit per-session revocation gate for already-issued tokens.

No Admin account, permission, Auth session, JWT, Realtime setting, database object, or Production data was changed in this audit.

## Follow-up: Production `admin_review_talent()` account-status transition — 26 November 2026

### P1: Talent approval RPC can reactivate an account outside `pending_verification`

Production function definition was read directly from `pg_proc` (read-only). Effective function:
- `public.admin_review_talent(uuid, boolean, ktp_status_type, text)` is `SECURITY DEFINER`, owned by `postgres`.
- `authenticated` has EXECUTE; `anon` does not.
- It checks `auth.uid()` and `has_admin_permission('talent')`, requires KTP decision `verified` or `rejected`, requires approval to pair with `verified`, and locks the target Talent profile, identity, and user rows.
- It requires the current KTP state to be `pending_review`.
- **On approval**, it sets `users.account_status = 'active'` unconditionally when `p_is_approved=true`.
- **On rejection**, it sets `users.account_status = 'pending_verification'` unconditionally.

That differs from repository migration `32_fix_admin_review_talent_sets_is_approved.sql`, whose intended logic only changes `account_status` from `pending_verification` to `active`; its comment explicitly says suspended/banned accounts must not be reactivated. Production's current function definition does not preserve that guard.

Impact: if an account has a Talent profile and KTP still `pending_review`, a Talent Admin approving the profile can change a `suspended` or `banned` account to `active`. Rejecting can also overwrite a suspended/banned status with `pending_verification`. This is a potential account-restriction bypass through the review RPC. No account row was read to determine whether such a case currently exists.

Related active triggers inspected:
- `users.trg_prevent_user_security_column_tampering` permits verification/account-status changes when `can_admin_access_ktp(NEW.id)` is true; it does not preserve the target's prior suspended/banned status.
- `users`, `user_identities`, and `talent_profiles` have `private.guard_active_account_write()` triggers. That helper checks the acting user's account status; for the RPC the actor is the Admin, not the target. It therefore does not by itself enforce the target's allowed status transition.
- `admin_review_ktp()` has a safer conditional transition: it activates only when the target is currently `pending_verification`. That guard is not mirrored by Production `admin_review_talent()`.

### Required remediation

1. Update `admin_review_talent()` through a new forward migration generated with the Supabase CLI workflow; do not edit migration 32 or any applied migration.
2. Before changing `account_status`, lock/read the target current status and permit activation only from `pending_verification`; preserve `suspended` and `banned` unchanged for both approve and reject decisions.
3. Keep KTP approval and `talent_profiles.is_approved` as separate outcomes; approval of a Talent listing must not override account suspension/banning.
4. Add SQL regression tests for pending_verification, active, suspended, banned, duplicate review, KTP rejected, KTP verified, and role/permission denial.
5. Verify function definition and `has_function_privilege` after migration in Staging; inspect aggregate status-transition counts without exposing user identities.

**Release blocker:** do not treat the Talent approval workflow as fully secure until this transition is corrected and Staging-tested. No Production function, user status, migration, or permission was changed during this inspection.

### Related Production notification finding reaffirmed

`notify_on_booking_message_insert()` remains configured to store the first 120 characters of the chat message in the recipient's notification body. Since the push function sends notification.message, private chat text can appear in push notification previews/lock screens. This was previously documented in `docs/YUKU-REALTIME-NOTIFICATION-SESSION-AUDIT.md`; verify the forward migration is deployed before treating generic chat notifications as active in Production.
## Follow-up: KTP review audit attribution gap — 26 November 2026

### P2: `admin_review_ktp()` does not persist a reviewer decision audit event

Production function `public.admin_review_ktp(uuid, ktp_status_type, text)` and all active triggers on `public.user_identities` were inspected read-only.

Confirmed behavior:
- The RPC checks Talent permission for Talent targets and Support permission for Customer targets.
- It accepts only `verified` or `rejected`, locks the `user_identities` row, and only processes `pending_review`.
- It updates KTP status and triggers the corresponding user notification.
- It does **not** insert a row into `admin_audit_logs`.
- On approval, `verified_by_admin_id` records `auth.uid()` and `verified_at` is set.
- On rejection, `verified_by_admin_id` and `verified_at` are both set to NULL. The rejection reason is retained, but the reviewer identity and decision timestamp are not.
- The active `user_identities` triggers inspected enforce evidence, immutability, account eligibility and notifications; none writes a reviewer audit event.

Impact: a KTP rejection has no durable database record identifying which Admin made the decision or when. An approval has partial attribution on the identity row, but no consistent append-only decision event. This weakens dispute handling, reviewer accountability and investigation of mistaken or abusive decisions. No identity rows or audit records were queried.

Required remediation:
1. Add an append-only Admin audit event inside the same transaction as the KTP decision, with server-derived actor `auth.uid()`, target user ID, prior/new KTP status, decision timestamp and a sanitized reason code/text.
2. Do not place KTP numbers, document paths, signed URLs, images or other evidence in the audit payload.
3. Preserve rejection reviewer attribution separately from `verified_by_admin_id` (which should continue to mean verifier only), either in the audit event or dedicated `reviewed_by_admin_id` / `reviewed_at` fields.
4. Ensure Customer KTP review requires Support permission and Talent KTP review requires Talent permission, as the current function intends.
5. Add tests proving Customer/Talent role boundaries, no duplicate review, actor attribution on both approval and rejection, and that authenticated clients cannot edit/delete audit events.

**Validation boundary:** this is a Production function/trigger source inspection only. No migration, audit row, user identity, function, permission or Production setting was changed. Treat reviewer attribution as a release hardening requirement before operating KTP moderation at scale.
### Implementation note: do not replay migration 32 verbatim

Follow-up comparison of the exact repository file `supabase/migrations/32_fix_admin_review_talent_sets_is_approved.sql` confirms its conditional account activation (`WHERE account_status = 'pending_verification'`) is the desired invariant. However, that historical function body is not a drop-in replacement for today's Production function:
- Migration 32 checks `public.is_admin()`. Production `is_admin()` was later narrowed to Super Admin/service_role, while the active `admin_review_talent()` uses `has_admin_permission('talent')` so scoped Talent Admins can review.
- Production's active function also writes a before/after `admin_audit_logs` record and requires a rejection reason; migration 32 does not include those later behaviors.
- Therefore the remediation must be a new forward migration based on the current Production function body, preserving current Talent permission checks, row locks, evidence validation, notifications and audit logging while fixing only the unsafe account-status transition. Do not copy/paste migration 32 as a whole.
## Follow-up: Account suspension, reactivation and Admin role lifecycle — 26 November 2026

### Production-vs-branch comparison: account-management Edge Function

Inspected the ACTIVE Production Edge Function `account-management` (version 1) and compared its source with `supabase/functions/account-management/index.ts` on `feat/professional-services-categories`.

**P1 — Production reactivation endpoint can bypass initial verification.**
- Production accepts `set_status` with `nextStatus='active'` whenever the target is not already active and not `banned`; it does not require the current status to be `suspended`.
- Therefore a Super Admin who calls the Edge Function directly (not through the current UI) can transition a `pending_verification` Customer/Talent account to `active`, bypassing the intended initial verification state.
- The Admin UI only renders the reactivation action for `suspended` accounts, but UI visibility is not an authorization boundary.
- The feature-branch source already contains a server-side guard requiring `nextStatus='active'` to pair with `target.account_status='suspended'`. Production version 1 does not contain that guard. The source fix is not deployed.
- This is not a public unauthenticated path: the Edge Function validates the bearer token, checks the actor's active account, and requires `get_admin_access().is_super_admin=true`. It is nevertheless an authorization/state-machine bypass available to an authorized Super Admin through direct invocation.

**Required action:** deploy the already-reviewed branch guard only after Staging tests; test direct invocation attempts for `pending_verification -> active`, `active -> active`, `suspended -> active`, and `banned -> active`. Do not treat UI hiding as sufficient protection.

### Existing account and Admin-role protections confirmed

- Authenticated users have SELECT, but no direct column UPDATE grant, on `users.role`, `users.account_status`, or `users.is_verified_18` in Production.
- `private.is_active_admin(user_id)` requires all three: `private.admin_accounts.is_active=true`, `public.users.role='admin'`, and `public.users.account_status='active'`.
- `get_admin_access()` derives permissions from the live private Admin tables for `auth.uid()`; it does not trust user-editable profile metadata.
- `set_admin_active()` is Super Admin-only, locks the target Admin row, only targets `admin_level='admin'`, prevents the actor from disabling themselves, and writes an audit event. Disabling a scoped Admin makes database Admin access fail on the next authorization check; it does not itself ban that person from ordinary app login.
- `set_admin_permissions()` is Super Admin-only, blocks self-edits, validates permission keys against `talent`, `booking`, `finance`, `support`, replaces the permission set, and writes an audit event.
- `admin-management` Edge Function validates the signed-in user, requires Super Admin access, refuses to invite an email already associated with a Customer/Talent account, and provisions permissions through a service-role-only RPC. The RPC derives the Super Admin record from the supplied actor ID and validates that actor with `private.is_super_admin()`.
- `guard_active_account_write()` blocks writes by suspended/banned actors when an authenticated actor context exists; trusted service-role work is intentionally separate. `prevent_user_security_column_tampering()` permits the Customer-to-Talent self-service transition only for the caller's own row and preserves account status/verification fields.

### P2 — Account status, Auth ban and audit are a multi-system compensation flow

`account-management` updates `public.users.account_status`, then calls Supabase Auth `updateUserById(ban_duration)`, then inserts `admin_audit_logs`. On Auth or audit failure it attempts compensating rollback calls. These operations are not one atomic transaction.

An interleaving of two Super Admin status changes and a rollback can leave the database status, Auth ban duration and audit history temporarily or persistently out of sync. The optimistic `WHERE account_status = old_status` protects the initial database update, but rollback and Auth compensation are separate calls and are not protected by one per-user operation lock.

Recommended hardening: make the database the authoritative status state machine; serialize per-user transitions with a transactional RPC/row lock and append-only audit/outbox event; have a retryable worker reconcile Auth ban state to the latest committed desired status. Until then, test simultaneous suspend/reactivate requests and forced Auth/audit failures, and alert on DB/Auth state divergence.

### Permanent-ban workflow clarification

`account_status_type` includes `banned`, and the UI can display that state, but the current account-management UI/API only supports `active` and `suspended`; the endpoint rejects reactivation of `banned` and does not provide an action to set `banned`. Current suspension uses a very long Auth ban duration (876000 hours) and the database status `suspended`. This is not equivalent to a separately governed permanent-ban workflow. Define the policy, appeal path, and audit requirements before adding a permanent-ban control.

### Validation boundary

All checks above were read-only inspection of Production function definitions, Edge Function source/version, role helper functions, trigger definitions, and column privileges. No user IDs/records, email lists, Auth sessions, or account-specific statuses were read. No Edge Function was deployed, no migration applied, no account or Admin permission changed, and no Production setting was modified. Production account-management version 1 remains behind the feature-branch source guard.
### Follow-up: session revocation and stale Admin UI — 26 November 2026

**Production controls confirmed:**
- `private.is_active_admin(user_id)` requires the target to have an active private Admin registry row, `users.role='admin'`, and `users.account_status='active'`.
- `private.has_admin_permission(user_id, permission)` accepts only the four known permission keys and delegates to the live active-Admin check. Public wrappers `has_admin_permission(text)` and `is_super_admin()` derive the actor from `auth.uid()`; their anon EXECUTE grant returns false for unauthenticated callers because `auth.uid()` is null.
- Production contains 45 restrictive `account_status_active_guard` policies, 46 active `trg_guard_active_account_write` triggers, and `private.is_current_user_active()` is executable by authenticated users. This is database-side enforcement in addition to the UI.
- `AuthContext` reloads role/account status on `TOKEN_REFRESHED`, `USER_UPDATED`, explicit `refreshRole()`, and browser window focus. It globally signs out the client when it next verifies an account as `suspended` or `banned`.
- `set_admin_active()` and `set_admin_permissions()` are Super Admin-only and record audit events. Their changes are checked dynamically by database permission helpers, so revoked permissions should fail at the next protected database/RPC request even if the UI still displays a stale menu.

**P2 — Revocation is not instantaneous in the visible UI.**
- A browser tab that remains focused and has not refreshed its token may keep displaying a previously loaded Admin menu until the next focus/refresh event. Database/RPC authorization remains the security boundary; a stale button is not evidence that the protected action will succeed.
- Existing JWT access tokens are not retroactively rewritten. The account suspension flow bans future Auth refresh/login, while database restrictive policies and write triggers block app-table access for suspended/banned users. The current browser will sign out when it next performs account-status verification.
- No direct forced session revocation, realtime socket disconnect, or live client test was performed. Do not promise that an already-open Realtime connection closes immediately on Admin permission removal or account suspension.

**Required Staging tests:**
1. Revoke each Admin permission while the Admin tab remains open; verify direct RPC/Data API calls are denied immediately and UI refreshes after focus/token refresh.
2. Deactivate an Admin registry row while the Admin tab remains open; verify `get_admin_access()` returns no Admin access and scoped RPCs fail.
3. Suspend a Customer/Talent account while a session and Realtime channel are open; verify database reads/writes, Storage operations, new token refresh/login, and realtime authorization after reconnect.
4. Verify current access token expiry behavior and ensure the app signs out on next account-status verification.
5. Reconnect a previously open private booking chat after role/account revocation; ensure server-side channel authorization is re-evaluated.

Validation boundary: policy/trigger/function counts and definitions were inspected read-only in Production. No session IDs, Auth user records, realtime payloads, or customer data were read; no session was revoked and no policy/trigger/function was changed.
## Follow-up: signup, Talent role transition and password recovery — 26 November 2026

### P1 — Production blocks the Customer-to-Talent self-service role transition

Read-only inspection of active Production definitions found:
- `public.handle_new_user()` currently creates every new `public.users` row with role `customer`, regardless of `raw_user_meta_data.user_role`. This safely prevents signup metadata from creating an Admin, but differs from the current feature-branch migration 18 behavior that allows the `talent` signup choice.
- `public.become_talent()` is SECURITY DEFINER, requires `auth.uid()`, locks the caller's own `public.users` row, and only permits `customer -> talent` or idempotent `talent -> talent`. It does not grant Admin or change account status/age verification.
- Production `public.prevent_user_security_column_tampering()` rejects every role change by a non-Super-Admin. It has no exception for the narrow self-service Customer-to-Talent transition.
- The `users` table has `trg_prevent_user_security_column_tampering` BEFORE UPDATE, so the `UPDATE users SET role='talent'` inside `become_talent()` is rejected by the trigger for an ordinary Customer.
- `BecomeTalentPage.tsx` calls `become_talent()` after signup (or after the email-confirmation/login continuation). The call fails before the rest of the Talent application flow can complete. The UI surfaces the RPC error.

**Conclusion:** this is a confirmed Production source-level incompatibility between the active `become_talent()` RPC and the active role-tampering trigger. It can prevent Customers from completing Talent registration. No user-level reproduction was run.

**Existing branch remediation:** `supabase/migrations/20261127000900_allow_self_service_customer_to_talent_transition.sql` adds a narrowly constrained exception requiring `auth.uid() = OLD.id`, exact Customer-to-Talent transition, unchanged identity fields, and unchanged verification/account-status fields. It does not permit Customer-to-Admin, arbitrary role changes, status changes, or age-verification changes. This migration is present only on `feat/professional-services-categories`; it has not been applied to Production.

**Required rollout/test:** reconcile this forward migration with the authoritative Production trigger definition and migration history before applying. In Staging, test Customer -> Talent success; Talent -> Talent idempotency; Customer -> Admin denial; changes to another user's role denial; role + status/verification field tampering denial; suspended/banned actor denial; and Admin provisioning/revocation behavior. Confirm the `become_talent()` RPC remains authenticated-only.

### Signup and identity verification observations

- `RegisterPage.tsx` only offers Customer signup; selecting Talent navigates to `/daftar-talent`. The Talent form uses a separate `signUp()` call with `user_role='talent'` metadata.
- Production `handle_new_user()` deliberately ignores that metadata and always inserts Customer. The Talent onboarding depends on the subsequent `become_talent()` RPC, which is currently blocked by the trigger described above.
- New accounts are created with `is_verified_18=false` and `account_status='pending_verification'` in Production. This is a safe default; signup metadata/checkboxes do not make an account verified or active.
- The Talent form's date-of-birth and age check is client-side. Actual account age verification is handled later by KTP/identity review. Do not treat browser DOB or the checkbox as verified identity.
- Signup's age and Terms acceptance checkboxes are required in the UI but this review did not find a durable server-side acceptance record (policy version, timestamp, and user). Add a server-authoritative consent record before relying on it as legal evidence.

### Password reset and confirmation flow

- `ForgotPasswordPage.tsx` always displays a neutral response ('Jika email terdaftar...'), which is appropriate to reduce account/email enumeration. It ignores the returned Supabase `error` object as well as thrown errors, so SMTP/rate-limit/redirect failures are indistinguishable from successful dispatch to the user. This is a UX/operations limitation, not an account-enumeration vulnerability.
- `ResetPasswordPage.tsx` listens for `PASSWORD_RECOVERY`, checks error parameters in the URL, and calls `auth.updateUser({password})`. Invalid/expired-link and replay behavior has not been runtime-tested.
- The recovery page leaves the recovery token/code in the browser URL/history after success and leaves the recovery session active until the user signs out or the session expires. Recommend removing sensitive URL parameters after the auth client has consumed them and testing session cleanup after a successful reset.
- Both reset/change-password pages enforce an 8-character minimum client-side. Production Auth password policy (minimum length, leaked-password checks, CAPTCHA, email rate limits, SMTP delivery, and redirect allow-list) was not exposed by the read-only project metadata tool and remains unverified; do not infer it from the UI.

### Required Staging auth regression matrix

1. Customer signup with email confirmation on/off; verify `handle_new_user()` creates one Customer row and no duplicate profile.
2. Talent signup with confirmation on; verify the draft resumes after email confirmation/login and `become_talent()` succeeds exactly once.
3. Tampered `user_role='admin'` metadata; verify no Admin role or private Admin registry row is created.
4. Direct REST attempt to update own/another user's role, account status, and verification columns; all must be denied except the scoped RPC.
5. Password reset: valid link, expired link, reused link, malformed URL, email not registered, SMTP/rate-limit failure, and reset from an already signed-in session.
6. After password reset, verify token URL cleanup, intended session behavior, ability to log in with the new password, and old refresh-session behavior.
7. Signup and Talent application Terms/age consent evidence must be persisted with policy version and server timestamp; changing browser state or bypassing the UI must not forge consent.

### Validation boundary

Production review was read-only: active definitions and grants for `handle_new_user`, `become_talent`, `prevent_user_security_column_tampering`, and `guard_active_account_write`, plus trigger definitions. No signup, login, password reset email, account record, Auth user, email, or session was created/read/changed. No SMTP settings, Auth settings, redirect allow-list, migration, or Production function was modified. The self-service role-transition fix remains branch-only.
## Follow-up: KTP evidence, review workflow and public eligibility — 26 November 2026

### Confirmed controls in Production

- `storage.buckets` confirms `ktp-documents` is private, with a 5 MB limit and JPEG/PNG/WebP allowlist.
- Storage RLS currently has only two KTP policies: owner-folder INSERT and owner-or-authorized-reviewer SELECT. The reviewer predicate is `can_admin_access_ktp(folder_user_id)`. No public read, UPDATE, or DELETE policy exists for this bucket.
- `user_identities` owner INSERT/SELECT/UPDATE is scoped to `auth.uid()`. `protect_and_verify_user_identities()` overwrites submitted status on INSERT and only sets `pending_review` when both NIK and KTP path are present. On UPDATE it blocks owner edits to legal identity fields while pending_review or verified; a rejected owner can resubmit by changing KTP number/path, which clears rejection reason and returns status to pending_review.
- `public.is_talent_publicly_visible()` checks Talent role, active account, 18+ flag, verified KTP, Admin-approved Talent profile, and at least one approved/active service. Public `talent_profiles` SELECT and `talent_services` SELECT both apply this helper.
- `public.create_booking()` independently checks Customer active/18+/verified KTP and Talent active/18+/verified KTP/public visibility, approved profile, and approved active service. This is a server-side eligibility barrier; the UI is not the security boundary.
- `admin_review_ktp()` and `admin_review_talent()` are authenticated-only (not executable by anon). `admin_review_ktp()` scopes Customer reviews to Support and Talent reviews to Talent permission.

### P1 — Selfie evidence is uploaded but never persisted or available to reviewers

- `VerifyKtpPage.tsx` requires a selfie with KTP and uploads it to `ktp-documents` as `selfie_<timestamp>.<ext>`.
- The page stores only `ktp_storage_path` in `public.user_identities`; Production `user_identities` has no selfie path column. `AdminPage.tsx` loads only `ktp_storage_path`, and its KTP review modal creates a signed URL only for that KTP file. There is no reviewer view of the required selfie.
- Therefore the application tells the applicant both files were submitted, but the review workflow cannot retrieve the selfie from the identity record. The selfie becomes an unreferenced private Storage object. It cannot be linked reliably to the identity review, and the existing Storage policy has no user DELETE policy for cleanup.
- The upload sequence also uses `Promise.all`: if one upload succeeds and the other fails, or the later identity lookup/update/insert fails, the successful object remains orphaned. The current catch path does not remove already-uploaded objects.

**Remediation required:** add a dedicated `selfie_storage_path` (or a normalized evidence table with evidence type, object path, submission version, and timestamp); persist it atomically with the KTP path and identity submission; expose short-lived signed URLs only to the owner and permitted reviewer; add safe rollback/cleanup for partial upload and DB failure; define resubmission cleanup/retention. Create the migration through the supported Supabase CLI migration workflow, not by guessing a timestamp. Do not add public Storage access.

### P1 — Talent curation modal allows approval without a linked KTP image

- `AdminPage.tsx` displays a fallback message when `ktp_storage_path` is null: it says the Admin may still approve if verification was done by interview/emergency contact.
- The same modal's approval action calls `admin_review_talent(..., p_ktp_status='verified')`. Production `admin_review_talent()` requires a `pending_review` identity row but does not require a non-null KTP path, a KTP number, or persisted alternative evidence. It then sets `is_verified_18=true` and can activate the account when approved.
- This creates a policy gap: a Talent may be marked KTP-verified/18+ without a retrievable KTP document or durable evidence of the alternative interview process. The DB public-visibility and booking gates trust those verification flags.

**Remediation required:** either require the actual KTP evidence (KTP path + selfie evidence) before a `verified` decision, or implement a separately named, tightly controlled alternative-verification method with mandatory evidence type, reviewer identity, notes, timestamp, and audit event. Never represent interview/contact-only evidence as a standard KTP verification.

### P1 — Talent review can overwrite suspended/banned account state

- The active Production `admin_review_talent()` unconditionally writes `account_status='active'` on approval and `pending_verification` on rejection. Unlike `admin_review_ktp()`, it does not preserve the existing account status conditionally.
- A Talent review action could therefore reactivate a suspended/banned account or overwrite another status. This confirms the earlier P1 finding; do not expose this review action as safe for Production until a forward migration preserves suspended/banned states and requires the account to be in an allowed onboarding status.

### P2 — Customer KTP review lacks server-enforced rejection reason and audit log

- Production `admin_review_ktp()` accepts `p_reason` as nullable and does not reject a `rejected` decision with an empty reason. The Admin UI prompts for a reason, but direct RPC calls can bypass UI validation.
- The function does not insert `admin_audit_logs`. On rejection it clears `verified_by_admin_id` and `verified_at`, so the identity row does not preserve reviewer attribution. A reason may remain, but it is not a substitute for an append-only audit event.

**Remediation required:** enforce non-empty sanitized rejection reason in the RPC; append an audit event in the same transaction with actor, target, old/new status, timestamp and sanitized reason. Do not include NIK, document paths, signed URLs, or raw KTP content in audit JSON.

### KTP workflow Staging acceptance tests

1. Submit valid KTP + selfie; verify both object paths are durably linked to the same submission and both can be opened by the owner and the correctly scoped reviewer only.
2. Force KTP upload failure, selfie upload failure, DB insert/update failure, and network interruption after one successful upload; verify no orphan evidence objects remain.
3. Attempt cross-user upload, cross-user read, anonymous read, unauthorized Admin read, expired signed URL reuse, and path traversal; all must be denied.
4. Resubmit rejected evidence; verify old evidence retention/deletion policy, new evidence linkage, rejection reason reset, and new review version.
5. Direct RPC rejection without reason must fail; successful review must create immutable audit event.
6. Talent approval without KTP evidence or explicit alternative evidence must fail; alternative evidence must never be reported as KTP verification.
7. Approve/reject Talent while account is suspended/banned; account status must not become active or pending_verification as a side effect.
8. Catalogue query must hide every unverified, inactive, suspended/banned, unapproved, or no-active-service Talent; direct `create_booking()` must independently reject ineligible Customer/Talent.
9. Test concurrent duplicate Admin review decisions and ensure only one pending_review transition wins with consistent audit attribution.

### Validation boundary

Production inspection was read-only: `user_identities` columns, KTP Storage bucket metadata and policies, public RLS policies for users/identities/Talent/services/bookings, and definitions/grants for KTP review and public-visibility functions. No KTP image, NIK, identity row, booking row, or Auth user data was read. No file was uploaded/downloaded, no signed URL was created, and no Production schema, policy, function, bucket, or data was modified. Runtime upload/review tests remain for Staging.

## Public Talent profile, availability, media and booking CTA audit — 26 Nov 2026

### Positive controls confirmed in Production (read-only)

- is_talent_publicly_visible() requires Talent role, active account, 18+ flag, verified KTP, approved Talent profile, and at least one approved + active service.
- Public talent_profiles SELECT is scoped to owner, authorized Talent Admin, or is_talent_publicly_visible(); public talent_services SELECT additionally requires the individual service to be approved and active.
- talent_availability public SELECT is limited to publicly visible Talent; owners and authorized Talent Admins retain their own access. Production policy does not expose every Talent's schedule to anonymous visitors.
- create_booking() rechecks Customer active/18+/verified KTP and Talent active/18+/verified KTP/public visibility, approved profile, approved active service, service mode, server-side rate, and Asia/Jakarta availability. Client-side checks are not the security boundary.
- Booking overlap is protected by the Production exclusion constraint on Talent + overlapping time ranges for active booking states. Concurrent overlapping inserts cannot both succeed.
- Public browse query for legacy Talent cards includes rate columns in its data projection, but the current UI only renders the rate on the Talent detail/booking flow. Keep the browse-card UI price-free as required; avoid broadening rate display in discovery.

### P1 — Fail-closed media moderation compatibility gap (fixed on feature branch)

- TalentDetailPage.tsx previously fell back to a legacy talent_media projection without moderation_status when the moderation column was missing. It then used the legacy media_url directly rather than a short-lived signed URL. In a deployment where migration 65 had not been applied, this could bypass moderation and private-object access controls.
- TalentDashboardPage.tsx also treated legacy rows as approved during the same compatibility window. That was an owner-only display path, but it could misrepresent the moderation state and normalize an unsafe rollout order.
- Branch fix: both pages now fail closed when moderation schema is unavailable; neither uses legacy public media URLs. Gallery and dashboard media rendering require moderation columns and short-lived signed URLs. This aligns frontend behavior with migration 65's private bucket and approved-media Storage policy.
- Production read-only policy inspection confirmed talent_media_select_public_or_owner filters public rows to moderation_status='approved' and is_talent_publicly_visible(talent_id). The feature-branch fallback was therefore a rollout hazard, not evidence that the current Production policy was missing.

### P2 — Unconfigured availability currently means open availability

- Production create_booking() explicitly retains legacy behavior: when a Talent has no rows in talent_availability, it does not reject the requested time based on a schedule. Once any schedule rows exist, it enforces the matching specific-date slot (if one exists for that date) or weekly slot, including availability flag and full duration.
- The booking UI indicates when no schedule is configured, but the RPC still permits booking at any otherwise-valid future time. Decide before wider launch whether this is an intentional “always available until schedule configured” policy or whether publication/booking should require at least one availability slot. Do not silently change this business rule in Production.

### P2 — Professional service profile is discovery-only, not a booking route

- ProfessionalServicesPage.tsx lists only approved, active professional listings; ProfessionalProviderProfilePage.tsx shows unit-based rate on detail and explicitly says booking is not open.
- This is correct for the current safety boundary. Do not wire these cards to legacy hourly create_booking(); professional per-hour/session/day/project pricing requires the separate shared-booking contract and financial lifecycle work already documented.

### Required Staging acceptance tests

1. Anonymous and authenticated direct URL to a pending/rejected/inactive Talent profile returns no public profile; owner/admin access remains appropriately scoped.
2. Attempt direct table SELECT for unapproved/inactive services and availability belonging to non-public Talent; all denied. Verify exact coordinates/location records are not public.
3. Missing moderation column/schema-cache error: both detail and owner dashboard fail closed; no legacy media_url is rendered or used. With migration applied, pending/rejected media remains hidden publicly and approved media uses expiring signed URLs.
4. Expired signed URL, wrong-owner object path, direct public object URL, and object overwrite attempts fail.
5. Direct create_booking() calls with unverified/suspended Customer or Talent, unapproved/inactive service, invalid mode, invalid rate, unavailable slot, past/near-term start, and overlapping booking all fail.
6. Confirm the documented no-schedule behavior; test a Talent with zero availability rows and a Talent with weekly + specific-date overrides.
7. Verify browse cards remain price-free while detail page displays the correct approved service rate; changing rate after page load cannot alter the server-side booking snapshot.
8. Professional service listing/profile must never invoke legacy create_booking() or transform per-session/day/project pricing into hourly rates.

### Validation boundary

Production checks were read-only catalog/function/policy/constraint inspection. No user rows, exact coordinates, media objects, bookings, or payment data were read. No Production schema, RLS policy, Storage object, function, data, deployment, or feature flag was changed. Frontend changes are feature-branch-only; automated build/runtime tests are still required.


## Production follow-up — report moderation write-path audit (26 Nov 2026)

- Production grants authenticated app roles direct UPDATE on `reports_complaints.status`, `admin_notes`, and `resolved_by_admin_id`. The RLS policy scopes those writes to Support-permission Admins, but does not force them through `admin_resolve_report()`.
- Direct table updates can therefore bypass the RPC's row lock, status/business validation and `admin_audit_logs` entry. Reviewer attribution can also be set directly by a Support Admin.
- P1 remediation: revoke direct app-role UPDATE on moderation fields and make the audited, permission-checked RPC the sole write path. Keep reporter INSERT and reporter/Support SELECT separately scoped. Add negative tests for direct status/note/reviewer updates and positive tests for the RPC.
- Production `notify_on_report_status_change()` currently includes internal `admin_notes` in the reporter notification. The branch-only migration `20261127001000_stop_leaking_internal_report_notes.sql` fixes the message but has not been applied to Production.
- Production `notify_all_admins()` fans operational notifications out to every active Admin; branch migration `20261127001100_scope_admin_notifications_and_private_booking_chat.sql` narrows them by module permission but is not yet in Production.
- No Production writes were made. Keep both items as launch blockers until the forward migrations are reviewed and negative tests pass in Staging.
