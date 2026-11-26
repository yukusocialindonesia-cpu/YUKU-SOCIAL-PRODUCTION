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


### Customer and Talent evidence requirements are inconsistent

A second source pass found that `BecomeTalentPage.tsx` has a separate identity upload path: it uploads only a KTP image if `ktpFile` is present, and saves only `ktp_storage_path`; there is no selfie field or selfie validation in that Talent onboarding flow. The Customer `VerifyKtpPage` requires both KTP and selfie. The Admin review UI uses the same KTP-only evidence display for both roles.

This means the current product has two different evidence standards. Decide one explicit policy for Customer and Talent before changing the schema: if selfie-with-KTP is required for both, make it mandatory in both onboarding flows and Admin review; if it is required only for Customer, document the role-based policy and ensure Talent identity review has its own clear requirements. Do not infer compliance from a KTP-only Admin screen.

The Production aggregate status query returned 7 identity records, all `verified`, with no missing KTP storage paths. This is a count-only result; no personal identity data was inspected.

## Talent approval vs account suspension — confirmed Production mismatch, 26 November 2026

### P1: current Production admin_review_talent can reactivate a suspended/banned account

Read-only inspection of the effective Production function definition found:
- It requires an authenticated caller with talent Admin permission.
- It locks the Talent profile, identity row, and user row.
- Approval requires KTP status verified, and rejection requires a reason.
- It updates the Talent profile approval, identity KTP status, 18+ flag, account status, and writes an Admin audit event.
- **But it sets account_status = 'active' whenever p_is_approved = true, without checking the previous account status.** On rejection it similarly sets pending_verification unconditionally.

Production enum values include pending_verification, active, suspended, and banned. The account-security trigger permits a KTP-authorized Admin to change account status for that target. Therefore, a Talent Admin approving the profile can potentially reactivate a suspended/banned account without the separate Super Admin sanction-lift process. This is an authorization/lifecycle defect, not merely a UI issue.

The effective Production function is executable by authenticated, not anon or PUBLIC. Its permission guard is present; the defect is the state transition it performs after authorization.

### Branch source is safer but differs from Production

Branch migration 32_fix_admin_review_talent_sets_is_approved.sql has a safer approval transition: it only changes account_status from pending_verification to active. It leaves suspended and banned untouched. The subsequent migration 51 narrows the function's Admin permission check to Talent permission while preserving authentication.

However, the read-only Production function definition does not match this safe branch implementation. The production database migration ledger contains timestamp-based versions, so the numbered branch migration name alone cannot prove which exact source body was deployed. Reconcile the deployed function definition and migration history before assuming the branch behavior is live.

### Required correction and release checks

1. Make approval transition only pending_verification -> active; preserve suspended and banned unchanged.
2. On rejection, do not overwrite suspended or banned with pending_verification; preserve sanctions while independently setting profile/KTP review outcome.
3. Keep account reactivation after suspension/ban in a separate explicitly authorized Super Admin action with reason, audit log, and any required appeal/review flow.
4. Add Staging SQL tests for all four starting account states across Talent approval and rejection; assert only pending_verification may become active and suspended/banned never change.
5. Test Talent Admin, Super Admin, Support Admin, unauthenticated, and disabled Admin callers. Confirm that role-specific permission does not silently grant sanction-lift authority.
6. Compare pg_get_functiondef, function grants, trigger definitions, and migration history between Staging and Production after rollout.

No Production function, account, role, identity, or migration was modified. This is a read-only finding and must be treated as a release blocker until the deployed function is corrected and verified.


## Upload, replacement, deletion & review lifecycle follow-up — 26 November 2026

Scope: static review of the feature branch client flows and migrations. This is not a live Storage/RLS test.

### Confirmed findings

1. **Customer KTP + selfie are not a complete evidence pair yet (P1).**
   - `VerifyKtpPage.tsx` requires both files and uploads them with unique paths and `upsert: false`.
   - Only `ktp_storage_path` is persisted. The selfie is not associated with `user_identities`, so Admin cannot review it.
   - `AdminPage.tsx` selects and creates a 300-second signed URL only for the KTP object.
   - Uploads are parallel. If one upload succeeds and the other fails, or later identity lookup/save fails, the successful object is orphaned. Existing KTP is not retained for safe cleanup when a rejected submission replaces its path.
   - The KTP bucket currently has owner/admin SELECT and owner INSERT in the reviewed migration chain, but no owner DELETE policy. Do not add broad owner delete merely to support rollback.

2. **Talent application has a weaker KTP intake path than Customer verification (P1 workflow inconsistency).**
   - `BecomeTalentPage.tsx` does not require a KTP file or NIK in its client validation.
   - It uploads KTP only when a file was supplied and writes NIK/path only when present. It does not collect or upload a selfie.
   - The identity trigger leaves the record `unsubmitted` unless both NIK and KTP path are present. This should prevent the Talent from passing the later KTP-approved/public-visibility gates, but the UI can still complete the application flow and create a Talent profile before the identity evidence is complete.
   - Admin Talent review UI reads only the KTP path; no selfie is available to review.
   - Decision required before implementation: enforce one KTP+selfie standard for both Customer and Talent, or explicitly define and document a role-based evidence standard. Do not silently treat the current Talent form as verified.

3. **Talent media lifecycle has safer branch controls, subject to rollout (P1 until deployed and tested).**
   - Migration 65 makes the bucket private, routes reads through `can_read_talent_media_object`, and requires short-lived signed URLs for public-approved media.
   - Migration `20261127001300_make_talent_media_objects_immutable.sql` removes owner UPDATE on `storage.objects`; a replacement must use a new object path and a new pending moderation row.
   - Migration 53 still permits owner/admin DELETE for Talent media. This is intentional for removing content, but needs a test that deleting an object does not leave a misleading approved `talent_media` row or broken gallery entry. Confirm application deletion order/cleanup behavior.
   - `TalentMediaModerationPanel.tsx` creates 1800-second signed URLs for Admin previews. Public/customer gallery rendering must also use signed URLs once the bucket is private; audit every consumer before applying migration 65.

4. **Professional-service evidence uploads are private and owner-folder scoped in branch migrations.**
   - Upload policy requires authenticated active account, own UUID folder, and existing Talent profile.
   - Bucket is private, 10 MiB, MIME allowlist PDF/JPEG/PNG/WebP.
   - Reviewed source provides upload restriction and bucket creation; it does not establish a complete safe replacement/deletion lifecycle. Add owner/admin read authorization only for actual review flows and avoid broad public read.

### Required fixes/tests before release

- Add nullable `selfie_storage_path` and update Customer/Talent form types, uploads, Admin review UI, and scoped signed-URL creation in one coherent migration/client release.
- Use a server-controlled cleanup mechanism for orphaned and superseded private evidence. Preserve the currently referenced evidence until the replacement row update commits; do not grant general client DELETE on the KTP bucket.
- Make multi-object upload failure compensatable and idempotent; record the paths created by one submission and clean only those exact unreferenced paths through a narrowly authorized server-side operation.
- Require the agreed evidence set before Talent application can be submitted as ready for review; show explicit incomplete-verification state otherwise.
- For Talent media, test new upload => pending, approval => readable signed URL, rejection => not readable by public, overwrite/upsert => denied, new replacement => pending, owner delete => no stale gallery entry, unrelated user => denied.
- For KTP, test Customer and Talent owner, unrelated Customer/Talent, Support Admin, Talent Admin, Super Admin, anon, and service-role boundaries; verify no public URL works and signed URLs expire.
- Test partial upload failures, DB save failures, rejected resubmission, replacement path retention, and cleanup retry/idempotency on Staging.

### Validation boundary

Only branch source and migration text were inspected. No SQL was executed, no Storage objects were read or changed, no migration was applied, and no Production or Staging configuration was modified. The above findings are source-level until replayed against Staging and exercised through Storage API requests.


### Talent gallery upload/delete code-path verification

A deeper client-flow review of `src/pages/TalentDashboardPage.tsx` confirms:

- Uploads use per-user unique paths and `upsert: false`; file type, size and duration are checked client-side. The database trigger forces new media rows to `pending`.
- If the `talent_media` INSERT fails, the client attempts to remove the just-uploaded object. If signed-URL creation fails after INSERT, it attempts to delete the row and object. These cleanup calls are best-effort and their returned errors are ignored; a failed Storage removal can leave an orphan object.
- Delete flow removes the database row first, then attempts Storage removal. A failed Storage removal is not surfaced to the user and leaves an unreferenced private object. This does not make it publicly readable under the branch helper because reads require a matching `talent_media` row, but it creates storage-retention/cost and privacy-retention work.
- Public profile `TalentDetailPage.tsx`, owner dashboard, and Admin moderation panel all generate 1800-second signed URLs when the moderation schema is available. The profile has a compatibility fallback to legacy `media_url` only when the moderation column is absent; migration 65 makes the bucket private, so rollout order and schema detection must be tested together.
- The Admin professional-service review page generates 300-second signed URLs for credential and supporting evidence. No public URL fallback was found in that review path.

### Additional release tests

- Force Storage remove failure after successful row delete and verify the UI reports cleanup pending (or a server-side cleanup queue records it).
- Force database INSERT failure after successful object upload and verify exact-path cleanup; retry must be safe.
- Verify an orphaned object cannot be signed/read by anon, unrelated authenticated user, or Admin without a linked authorized record.
- Verify the compatibility window: frontend before migration 65, migration 65 before/after frontend, and ensure no private-bucket media is rendered from a public URL.
- Confirm legacy rows without `storage_path` are intentionally hidden or migrated before private-bucket rollout; the new profile code intentionally renders no URL for such rows once moderation schema exists.
