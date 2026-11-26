# YUKU Account, Identity & Role Lifecycle Security Audit

Date: 26 November 2026
Branch: `feat/professional-services-categories`
Scope: signup, role initialization, Customer-to-Talent conversion, KTP review, Admin provisioning, account suspension/reactivation, and session enforcement.

## Findings

### P1 — Customer-to-Talent conversion blocked by the final role guard

Migration 31 exposes `public.become_talent()` as the supported self-service Customer-to-Talent transition. It locks the caller's own `public.users` row and changes only the caller's role from Customer to Talent. The frontend calls this RPC when an existing Customer completes the Talent application.

Migration 62 later introduced `prevent_user_security_column_tampering()`, which rejected every role change unless the caller was Super Admin. This unintentionally blocked the legitimate `become_talent()` RPC for existing Customer accounts. New Talent registrations did not expose the defect because the signup trigger initialized them directly as Talent.

### Fix applied

Migration: `20261127000900_allow_self_service_customer_to_talent_transition.sql`  
Commit: `a71902c999081ec132f070d541d0ccba5aecad38`

The final trigger guard now permits exactly one non-admin role transition:
- actor is authenticated;
- `auth.uid() = OLD.id = NEW.id`;
- old role is Customer and new role is Talent;
- id, email, creation time, age-verification flag, and account status are unchanged.

All other role changes remain Super Admin or trusted service-role only. The transition does not approve the Talent profile, verify KTP/age, activate a pending account, approve services, or make the Talent publicly visible. Those remain separate review gates.

## Signup and metadata review

- The signup trigger maps user-provided `user_role` metadata only to the two allowed self-service roles: Talent or Customer. It never creates Admin from signup metadata.
- Name/city metadata is profile content, not authorization.
- Public role and account status are stored in `public.users`; the app reads those values from the database.
- User-editable Auth metadata is not used as an Admin permission source.
- Role, KTP-derived verification, and account-status changes are guarded at the database layer.
- Signup starts with `pending_verification` and `is_verified_18 = false`; selecting Talent does not bypass KTP or Admin approval.

## KTP and identity review

- `admin_review_ktp` checks target role: Talent requires Talent permission; Customer requires Support permission.
- Only `pending_review` identity records can be decided.
- KTP approval updates the 18+ flag and activates only accounts currently in `pending_verification`; it does not reactivate suspended/banned accounts.
- Rejection clears the 18+ flag and does not activate the account.
- Identity/legal fields and verification metadata are protected by the identity trigger and scoped permissions.
- KTP evidence remains private and is not made public by profile role selection.

## Admin provisioning

- Admin invitation is backend-only through a service-role RPC.
- The invitation RPC requires an active Super Admin as inviter, validates the permission list, atomically creates the Admin registry and permissions, and writes an audit event.
- Direct authenticated invocation of provisioning RPCs is revoked.
- The final user security trigger allows trusted service-role operations but does not permit normal users to self-assign Admin.
- Super Admin account management RPCs remain Super Admin-only.

## Suspension, reactivation, and session behavior

- Account-management Edge Function verifies the caller's Auth token, active database account, and Super Admin access before acting.
- It only targets Customer/Talent accounts; Admin accounts cannot be suspended through this endpoint.
- Status transitions are limited to active/suspended, require a reason, use an optimistic status check, apply an Auth ban/unban, and attempt compensating rollback if Auth or audit persistence fails.
- Database restrictive RLS and write triggers block suspended/banned users even if an old access token has not expired.
- AuthContext and LoginPage reject suspended/banned accounts and remove their sessions.
- Account deletion is deliberately disabled; preflight is read-only and manual-review-required.

## Validation still required

1. Run the complete migration chain on Staging and confirm trigger ordering and effective function definitions.
2. Test new Customer signup, new Talent signup, existing Customer -> Talent, repeated become_talent calls, and Admin attempts to change role.
3. Confirm Talent role alone cannot publish or be discovered before KTP and profile/service approval.
4. Test KTP approval/rejection for Customer and Talent with each scoped Admin permission and Super Admin.
5. Test Admin invitation with Super Admin, scoped Admin, Customer, suspended Super Admin, and invalid permission arrays.
6. Test account suspension/reactivation while sessions exist on multiple devices; verify Data API writes, RPCs, Storage, Realtime, and Edge Functions reject suspended users.
7. Test failure/rollback paths for Auth ban update and audit-log insert.
8. Confirm no user-editable `raw_user_meta_data` value is consulted by RLS or authorization logic after signup.

## Validation boundary

The role-transition conflict was identified by comparing migration 31's RPC, migration 62's final trigger guard, and the frontend call site. The fix migration was fetched back from the feature branch and checked statically. No live SQL was run, no migration was applied, no Staging or Production data was changed, and no Edge Function was deployed. PostgreSQL replay and end-to-end role tests remain required before release.

## Production read-only follow-up — 26 November 2026

### Effective signup trigger differs from the historical branch migration

A read-only inspection of the live Production definition of `public.handle_new_user()` found that it currently:
- Reads user-editable `raw_user_meta_data` only for display name and phone number.
- Hard-codes the initial `public.users.role` to `customer` and `account_status` to `pending_verification`.
- Creates a Customer profile with no inferred city or gender.
- Does not use signup metadata to grant Talent or Admin privileges.

This is safe from metadata-based role escalation, and it aligns with the current Talent application flow: `BecomeTalentPage` subsequently calls the authenticated, idempotent `become_talent()` RPC after the applicant submits the Talent form. The RPC changes only the caller's own Customer role to Talent; the later KTP and profile approvals remain separate gates.

However, the branch's historical migration `18_security_and_payout_guardrails.sql` still contains a version that maps `raw_user_meta_data.user_role = 'talent'` directly to the initial Talent role. That differs from the live Production definition. The role remains non-public until later approvals, but the discrepancy can cause branch/Staging signup behavior to diverge from Production and should be reconciled before the next schema release. Do not treat the live function definition as proof that migration 18 is absent; the live migration ledger shows migration 18 applied, so the current function has been replaced or adjusted after that migration.

The UI route and current implementation support the safer customer-first path: Talent applicants use `/daftar-talent`, and the form invokes `become_talent()` after successful submission. Preserve that flow when reconciling the migration chain; do not simply restore metadata-driven role assignment without testing the full signup/confirmation/application sequence.

### Production account/session guard verification

Read-only Production checks confirmed:
- `private.is_current_user_active()` exists.
- The account-status write trigger is installed on 45 public tables and `storage.objects`.
- 44 restrictive active-account policies are present on RLS-enabled public tables; the `users` table is intentionally excluded so the owner can read their own account status.
- All 49 public tables with RLS are covered by RLS; there are no public tables without RLS in the current inventory.
- At the time of the aggregate snapshot, there were 0 suspended/banned public profiles and 0 Auth users with a currently active `banned_until` timestamp. No user identifiers or session tokens were queried.
- Seven non-expired Auth sessions existed at the time of the session snapshot; aggregate count only.

AuthContext source review confirms that `TOKEN_REFRESHED` and `USER_UPDATED` force a role/account-status reload, and the app also rechecks on window focus. If the account-row lookup fails, role/Admin access is cleared; database RLS and write triggers remain the data-access boundary.

### Validation boundary

These are read-only Production observations and source comparisons. No Auth users, sessions, user profiles, migrations, or Production settings were modified. Staging tests are still required for a suspended account with existing sessions across Data API, RPC, Storage, Edge Functions, and open Realtime connections.
