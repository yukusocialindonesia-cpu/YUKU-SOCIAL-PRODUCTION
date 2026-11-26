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

- The branch's historical migration 18 maps user-provided signup metadata only to Talent or Customer and never creates Admin. The current Production function differs: it hard-codes the initial role to Customer, then the Talent application flow calls `become_talent()` after form submission. See the Production follow-up below; reconcile this migration drift before the next schema release.
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


## KTP + selfie evidence workflow audit — Production read-only, 26 November 2026

### Confirmed P1: selfie evidence is uploaded but never attached to the identity record or reviewed

Source flow in `src/pages/VerifyKtpPage.tsx`:
1. Requires both an e-KTP image and a selfie holding the e-KTP.
2. Uploads both objects to the private `ktp-documents` bucket using separate paths and `upsert: false`.
3. Saves only `ktp_storage_path` to `public.user_identities`; no selfie path is saved.
4. On a failed upload, failed identity lookup, or failed database save, successful Storage uploads are not rolled back.

Production schema read-only check confirms `public.user_identities` has `ktp_storage_path` but no `selfie_storage_path`. AdminPage selects only KTP path for both Customer and Talent identity review. The Customer KTP preview creates a 300-second signed URL for the KTP only. There is no selfie preview or review step.

Production Storage metadata-only aggregate snapshot:
- `ktp-documents` exists and is private.
- File size limit is 5 MiB; allowed MIME types are JPEG, PNG, WebP.
- 16 objects were present: 7 named as KTP uploads and 9 named as selfie uploads.
- All 9 selfie objects were unreferenced by the current schema because there is no selfie path column.
- 0 KTP objects were unreferenced by `user_identities.ktp_storage_path` at the snapshot time.

No object content, filenames, user IDs, or signed URLs were read. No Storage object was deleted or modified.

### Additional lifecycle defects in the client

- The two uploads run concurrently with `Promise.all`. If one succeeds and the other fails, the successful object is left behind.
- If both uploads succeed but identity lookup or database save fails, both objects remain.
- When a rejected user resubmits, the current code selects only the existing identity `id`, then replaces `ktp_storage_path` without retaining the old path for cleanup. This can orphan the previous KTP image.
- The current KTP bucket policies allow owner/admin SELECT and owner INSERT; there is no owner DELETE policy for `ktp-documents`. A naive client-side rollback using Storage `remove()` would therefore fail under current RLS. Do not add broad delete access merely to make cleanup work.

### Existing controls verified

- `user_identities` owner INSERT and owner UPDATE are scoped to `auth.uid() = id`; SELECT is owner or role-scoped KTP Admin.
- The identity trigger forces user INSERT with KTP number + KTP path to `pending_review`, clears user-supplied review metadata, and blocks owners from editing legal identity fields while pending or verified.
- A rejected submission can be resubmitted; changing its KTP number/path resets status to `pending_review` and clears the rejection reason.
- `admin_review_ktp` checks the target role and requires Talent permission for Talent identities or Support permission for Customer identities. It locks the identity row and only accepts a decision while status is `pending_review`.
- Successful approval sets `is_verified_18=true` and activates only accounts in `pending_verification`; rejection clears the 18+ flag. It does not automatically reactivate suspended/banned accounts.
- KTP evidence is private. Admin signed URLs are short-lived (300 seconds) and require Storage SELECT authorization.

### Required complete remediation (do not ship a partial fix)

1. Add nullable `selfie_storage_path` to `public.user_identities` with the same owner/admin read boundary as KTP path; do not expose the column publicly or include it in generic user summaries.
2. Update VerifyKtpPage typed record, lookup, insert/update, and success handling to persist both paths.
3. Update AdminPage's Customer and Talent review projections and UI to create separate short-lived signed URLs for KTP and selfie, show both images, and make approval/rejection decisions only after both required files are available. Handle missing legacy selfie as an explicit legacy exception, not as an approved evidence check.
4. Implement safe cleanup for partial upload failures and DB failures through a narrowly scoped server-side operation or policy that can delete only the caller's unreferenced objects. Never allow deletion of evidence currently referenced by a pending/verified identity. Preserve old paths until the replacement row transaction succeeds; then schedule controlled deletion of superseded evidence.
5. Define retention, deletion, and audit-log rules for superseded/rejected evidence, including orphan discovery and cleanup. Do not delete the 9 existing selfie objects until their ownership and retention implications are reconciled.
6. Test Customer and Talent flows, first submission, rejected resubmission, partial upload failure, database failure, concurrent resubmission, admin role matrix, expired signed URL, owner denial of admin evidence, and retention cleanup in Staging.

This follow-up is documentation and read-only Production inspection only. No Production schema, policies, bucket settings, identity rows, Auth users, or Storage objects were changed. No migration was applied. The complete remediation is not yet implemented and must remain a release blocker for the identity verification workflow until the full flow is shipped and tested.
