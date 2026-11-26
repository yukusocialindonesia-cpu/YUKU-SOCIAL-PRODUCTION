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