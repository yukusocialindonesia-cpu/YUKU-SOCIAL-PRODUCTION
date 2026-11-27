# YUKU Release Readiness Audit — 27 November 2026

Status: source/repository audit in progress. This is not a release approval.
Scope: active YUKU branch stack, GitHub workflows, frontend scripts, Supabase migrations/tests, Merchant Partner and Professional Provider release gates.
Safety: no Supabase SQL was executed; no Production configuration, database, payment route, or deployment was changed.

## Executive summary

YUKU has substantial product and security work in progress, but the current branch stack is not ready to merge or launch as one unit. The immediate blockers are migration-version collisions, missing CI coverage for the current PR base branch, and missing executed Staging evidence for newly introduced provider/merchant authorization paths.

## Confirmed findings

### P0 — Supabase migration timestamps collide

The active PR #287 branch contains 143 migration files. A live read-only query on 27 November found 129 migrations recorded in Production, latest version `20261126124423` (`harden_professional_application_revision_attestation_fields`). PR #265's separate branch contains 125 migration files and can match only 74 Production entries by exact version or normalized name; 55 Production entries remain unmatched. PR #287 does not include PR #265's filename reconciliation. The following version prefixes occur more than once in PR #287:

| Version | Files |
|---|---|
| `62` | `62_index_admin_audit_actor_foreign_keys.sql`; `62_scoped_admin_trigger_guard_hardening.sql` |
| `20261126190000` | `20261126190000_grant_professional_service_data_api_roles.sql`; `20261126190000_harden_payout_request_insert_access.sql` |
| `20261127000700` | `20261127000700_professional_provider_identity_decoupling.sql`; `20261127000700_remove_legacy_public_talent_services_policy.sql` |
| `20261127001000` | `20261127001000_harden_professional_application_revision_attestation_fields.sql`; `20261127001000_link_talent_selfie_evidence_and_guard_approval.sql`; `20261127001000_stop_leaking_internal_report_notes.sql` |
| `20261127002000` | `20261127002000_finalize_social_experience_taxonomy.sql`; `20261127002000_merchant_partner_membership_foundation.sql` |
| `20261127003000` | `20261127003000_merchant_admin_review_and_directory.sql`; `20261127003000_talent_custom_social_experience_services.sql` |
| `20261127004000` | `20261127004000_create_independent_professional_provider_profiles.sql`; `20261127004000_merchant_membership_management.sql` |
| `20261127005000` | `20261127005000_allow_professional_only_applications.sql`; `20261127005000_merchant_offers_directory.sql` |

Supabase migration files require unique versions and are applied in version order. The collision list is a filename-level finding only; do not simply assign arbitrary timestamps. First determine dependencies and whether any file has already been applied in Staging or another environment. The 55 unmatched Production entries must also be recovered/mapped. Do not run `db push` or attempt to repair remote history until these issues are reconciled against the target project's actual migration history and dependency order. PR #265 separately proposes reconciling historical migration filenames; it is still open and is not in this branch's PR ancestry.

### P0 — Current PR stack is not receiving the main build workflow

`.github/workflows/main-build-validation.yml` limits pull requests to base branches `main` and `fix/yuku-final-service-taxonomy`. PR #287 targets `design/beranda-premium-compact`, so it does not match the workflow's pull-request branch filter. PR #282 targets `feat/independent-professional-provider-identity`, and PR #280 targets `fix/jelajah-companion-professional-separation`; those bases are also absent from the filter.

The latest queried status/workflow-run responses for the active PR head were empty. This means validation is unknown/not detected, not passed. The workflow filter was expanded on PR #287's base branch (`design/beranda-premium-compact`) and the active head branch. After the head update, both `YUKU main build validation` and `Account management build and type checks` ran for commit `4e16c5dcc881c055a3a25e4d09f4591e6d0ab737` and completed successfully: TypeScript check and production build both passed. The later documentation-only commit does not trigger these path-filtered workflows.

### P1 — Frontend CI is build/typecheck only

`package.json` exposes `lint` (TypeScript `tsc --noEmit`) and `build` (Vite production build), but no `test` script. The repository has nine SQL security-test files (Stage A through H), but no dedicated automated test suite was found for the new independent Professional Provider or Merchant Partner flows in the inspected test directory.

### P1 — New Merchant Partner and independent Professional Provider paths remain staging-gated

- Merchant RLS/RPC plan is a checklist, not evidence of execution.
- Merchant migration preflight exists, but it has not been run.
- The Merchant scope document explicitly says UI and review workflow are not live until migrations pass Staging validation.
- Professional Provider changes require independent-profile, publication, document-storage, and Super Admin authorization regression tests.
- No migrations were run on Staging or Production as part of this audit.

### P1 — PR stack has parallel branches that are not automatically included

Current dependency chain observed:
- PR #280: taxonomy, based on `fix/jelajah-companion-professional-separation`.
- PR #281: independent Professional Provider, based on PR #280's head branch.
- PR #282: compact homepage, based on PR #281's head branch.
- PR #283: product concept docs, based on PR #282's head branch.
- PR #284: exact Social Experience service ID foundation, also based on PR #282's head branch.
- PR #287: homepage/ecosystem/merchant work, also based on PR #282's head branch.
- PR #285 and #286: independent audit/documentation PRs targeting `main`.
- PR #265: historical migration filename reconciliation targeting `main`.

PR #284 and PR #287 are sibling branches, not a single linear stack. Do not assume PR #287 includes the exact service-ID booking foundation from PR #284.

## Release gate order

1. Reconcile the 55 unmatched Production migration entries and the 8 duplicate version groups; integrate/rebase PR #265 only after its mapping is refreshed and verified.
2. Make CI run on every intended PR base branch; require a visible green typecheck/build result.
3. Add and execute Staging SQL/RLS/RPC/storage tests for Professional Provider and Merchant Partner, including negative cross-account and cross-business tests.
4. Run end-to-end regression for signup/session restore, provider onboarding/review, discovery, booking, payment route lock, cancellations/refunds, notifications, Admin actions, and mobile navigation.
5. Review all open PR dependencies and merge only in a deliberate order after each release gate passes.
6. Only after explicit owner approval: apply approved migrations to Production and deploy. This audit authorizes neither action.

## Explicitly not done

- No Production or Staging migration was executed.
- No payment provider, webhook secret, or checkout route was changed.
- No PR was merged or retargeted.
- No deployment was triggered.
- No CI result is represented as passing unless a real run reports success.

## Live Production security and performance review — 27 November 2026

A read-only Supabase Advisor review and catalog inspection was run against Production project `sbqvltqzzcsqzijgumld`. No settings, grants, policies, functions, or data were changed.

### Security advisor findings

| Finding | Count | Assessment |
|---|---:|---|
| Public/anon can execute SECURITY DEFINER functions | 5 | Review required; not automatically exploitable |
| Authenticated can execute SECURITY DEFINER functions | 61 | Review RPC-by-RPC; sample financial/Admin RPCs include explicit identity and permission checks |
| RLS enabled but no policy | 3 | All reported tables are in the `private` schema; likely intentional only if access is through guarded functions |
| Leaked-password protection disabled | 1 | Enable in Auth security settings before public launch |

The five anon-callable functions were inspected:
- `has_admin_permission` and `is_super_admin` delegate to private helpers that require an active Admin identity.
- `is_talent_publicly_visible` returns only whether a Talent profile meets public eligibility rules.
- `can_read_talent_media_object` returns whether a media object is publicly approved/visible or belongs to the caller/admin.
- `guard_talent_media_moderation_fields` is a trigger-returning function; the Advisor flags its EXECUTE grant, but it is not an ordinary callable RPC.

Read-only null/unknown-identity probes returned `false` for anonymous finance permission, Talent permission, Super Admin, unknown Talent visibility, and an unknown media object. This supports the intended null-identity guard but does not replace authenticated/anonymous API-level RLS tests. Do not revoke helper EXECUTE grants blindly: public RLS and Storage policies currently call some of these helpers.

A sample of high-impact SECURITY DEFINER RPCs was inspected:
- `admin_process_payout` and `admin_process_refund` explicitly require a non-null `auth.uid()` and Finance permission.
- `admin_review_professional_service_application` explicitly requires a non-null identity and Admin Talent/Super Admin permission.
- `request_talent_services` does not repeat the identity check itself, but delegates each entry to `request_talent_service`, which enforces authenticated Talent ownership. Continue reviewing the remaining functions; the Advisor count alone is not a vulnerability verdict.

### Confirmed Production product/authorization mismatch

The live Production function `admin_review_professional_service_application` still joins `professional_service_applications` to `talent_profiles` and requires the Talent profile to be approved before Professional Services can be published. Therefore the current Production database does **not** yet support the intended independent Professional-only provider lifecycle, regardless of the newer branch code. The branch's independent provider migrations must be reviewed and Staging-tested before the product advertises Professional-only onboarding.

### Performance advisor findings

| Finding | Count | Priority |
|---|---:|---|
| RLS policies re-evaluate auth functions per row | 34 | Optimization after security regression |
| Foreign keys without covering indexes | 11 | Review workload and add only where useful |
| Multiple permissive policies | 2 | Correctness review; currently Admin-read + owner-read for Professional application/history |
| Unused indexes | 47 | Do not remove without production workload evidence |

The two multiple-permissive-policy findings are on `professional_service_applications` and `professional_service_application_status_history`, combining Admin-read and owner-read policies. They are not evidence of a bypass by themselves; inspect the policy predicates and test cross-account access.

### Recommended remediation order

1. Enable leaked-password protection in Supabase Auth settings after reviewing sign-in impact.
2. Add negative API/RLS tests for anon and authenticated callers against the public helper functions and all SECURITY DEFINER RPCs.
3. Review the 61 authenticated-callable functions by privilege class and verify identity/ownership/admin checks; do not mass-revoke.
4. Resolve the independent Professional Provider/Talent coupling in a reviewed migration sequence, then prove it in Staging.
5. Handle RLS-initplan and index warnings only after correctness tests and workload evidence.

### Booking, payment, refund and payout RLS spot-check

A read-only catalog inspection covered `bookings`, `payments`, `payout_requests`, `refunds`, `booking_messages`, `booking_status_history`, `customer_cancellation_cases`, `bank_transfer_submissions`, `qris_payment_submissions`, `talent_earnings`, and `payout_earnings_allocations`.

- RLS is enabled on all 11 inspected tables.
- The `anon` role has no direct SELECT privilege on the inspected tables.
- Authenticated direct INSERT/UPDATE privileges are absent on core booking, payment, refund, payout, and cancellation tables in the inspected grant results.
- `bookings` creation and sensitive payment/payout transitions are therefore expected to go through RPCs rather than direct table writes.
- `booking_messages` is the exception for direct INSERT privilege; its policy requires `sender_id = auth.uid()` and that the caller is a participant in the referenced booking.
- `payout_requests` still has a legacy INSERT policy, but authenticated table INSERT privilege is revoked. This is defense-in-depth consistent with the payout RPC migration; keep the grant/policy state aligned and test the intended RPC path.
- This was a schema/policy/grant spot-check, not an end-to-end negative test with real anon/customer/Talent/Admin JWTs. It does not prove every RPC transition or Storage object path is correct.

No direct database write was performed during this check.


### Payment, booking-state and financial RPC deep dive — read-only Production inspection

The following Production function definitions, constraints and scheduled-job metadata were inspected: `create_booking`, `claim_booking_payment_route`, `settle_booking_payment`, `confirm_booking_completion`, `admin_process_refund`, `admin_process_payout`, `request_talent_payout`, `expire_stale_booking_reservations`, and the booking status/financial triggers. No RPC was invoked and no row was changed.

**Positive controls confirmed**
- `create_booking` requires an authenticated active Customer, age/KTP verification, an active approved Talent, an approved active service, a valid future schedule and duration, and a matching online/offline category. The rate and 20% platform share are snapshotted server-side.
- A real PostgreSQL exclusion constraint exists on `bookings`: `EXCLUDE USING gist (talent_id WITH =, tstzrange(start_time, end_time) WITH &&)` for active/pending booking states. The similarly named GiST index is backed by this exclusion constraint, so overlapping Talent time slots are database-enforced, including concurrent inserts.
- `payments` has unique constraints on `booking_id`, `idempotency_key`, and `provider_charge_id`.
- `claim_booking_payment_route` locks the booking row, checks authenticated Customer ownership and pending/unexpired status, and prevents switching a locked route. New Xendit route selection is blocked; QRIS/bank transfer require active settings.
- `settle_booking_payment` is restricted to server/service-role execution, locks the booking row, enforces provider allow-list and route consistency, and upserts one payment per booking.
- `confirm_booking_completion` locks the booking row, requires an authenticated booking participant, and records each party's completion confirmation. The booking only transitions to completed once both Customer and Talent have confirmed.
- `admin_process_refund` requires Finance permission, locks refund/payment/booking/cancellation-case rows, checks total refunds against payment and automatic-refund limits, requires a unique provider refund reference, and writes an Admin audit record.
- `request_talent_payout` requires an active approved verified Talent, validates bank details and amount, and uses a caller-supplied idempotency key with payload matching. `admin_process_payout` requires Finance permission, row-locks the payout, validates allowed status transitions and requires a provider reference before completion.
- A live active pg_cron job runs `expire_stale_booking_reservations()` every five minutes.

**P1 — Settlement's expired-booking branch performs an update immediately before raising an exception**

In `settle_booking_payment`, when `payment_expires_at <= NOW()`, the function updates the booking status to `expired` and then raises an exception. In PostgreSQL, an uncaught exception aborts the current transaction, so that preceding UPDATE is rolled back; callers receive the error but this branch itself does not persist the expiry. Production does have a separate active five-minute cron job that expires stale reservations, so this does not leave expired rows permanently pending, but it makes the inline UPDATE misleading/redundant and delays state correction until the scheduled job runs. Remediation should either remove the UPDATE and rely explicitly on the cron, or return/commit through a non-exception path after persisting the expiry. Test the exact webhook/caller behavior in Staging before changing it.

**P1 — Already-settled webhook retries are acknowledged without comparing event identity**

For bookings already in `paid_held_in_escrow`, `confirmed_by_talent`, `in_progress`, or `completed`, `settle_booking_payment` returns TRUE immediately. It does not compare the incoming provider, provider charge ID, amount, or payment row against the existing settlement before acknowledging. This may be intended to make provider retries idempotent, but the current function does not distinguish a genuine retry from a conflicting event targeting the same booking. The unique `provider_charge_id` constraint protects new/upsert writes, but it is not consulted on this early-return path. Verify the Edge Function's signature verification, event-to-booking binding, provider amount/currency checks, and duplicate-event handling; then add a Staging negative test for a different charge ID/provider against an already-settled booking. Do not treat the current early return alone as proof of a payment bypass.

**Remaining payment/webhook evidence gap**
- This inspection covered the database settlement RPC, not the deployed payment-provider Edge Function or its raw webhook verification. Signature validation, event-ID deduplication, amount/currency equality, merchant-account binding, and retry/replay handling remain unverified.
- The payment webhook must be checked end-to-end against the exact provider event and the server-side booking/payment state before this flow can be release-approved.
- No live customer, Talent, Admin or service-role payment transaction was simulated.

No database writes, migration applications, function changes, cron changes, or deployments were performed during this deep dive.


### Xendit Edge Function source review — branch source only

The current PR #287 branch source for `supabase/functions/xendit-webhook/index.ts` and `create-checkout/index.ts` was inspected. This is a source-code review only; it does not prove either function is deployed to Production.

**Webhook controls present in source**
- POST-only endpoint and constant-time comparison of `x-callback-token` with `XENDIT_CALLBACK_TOKEN`.
- Only PAID/SETTLED events proceed; the external ID must match the expected `yuku-<UUID>` format.
- Invoice ID is required and bounded; currency must be IDR; paid amount must be a positive safe integer.
- The booking is loaded from the database and callback amount is compared to `bookings.gross_amount`; transient database errors return 5xx for retry.
- Settlement is delegated to the server-only `settle_booking_payment` RPC; permanent booking-state errors are acknowledged to avoid endless retries.
- Source comments explicitly state Xendit sandbox testing has not been completed.

**Remaining P1 release gaps**
- The webhook does not fetch/reconcile the invoice from Xendit's API using the callback invoice ID before settlement. Callback-token validation is a meaningful control, but provider-side invoice identity/status/currency reconciliation is still absent.
- No durable event-ID/idempotency ledger is visible in this Edge Function. The database's unique provider charge ID and one-payment-per-booking constraints help, but the settlement RPC's early return for already-paid bookings does not compare the incoming invoice ID/provider to the stored payment.
- `create-checkout` source calls `claim_booking_payment_route(..., 'xendit')`, while the live Production RPC rejects Xendit for a booking whose route is still NULL. This is intentional route policy, so new Xendit checkout is currently unavailable unless policy is explicitly changed after sandbox validation.
- Both Edge Function files state that sandbox tests remain outstanding. There is no evidence in this audit that these source files or their required secrets/callback configuration are deployed and working in Production.

Before enabling Xendit, run Staging tests for invalid callback token, malformed external ID, wrong invoice ID, wrong amount, wrong currency, wrong provider/route, expired booking, duplicate identical callback, conflicting invoice ID for an already-settled booking, concurrent callbacks, provider timeout/retry, and provider-side invoice lookup/reconciliation. Keep new Xendit checkout disabled until that evidence is recorded.


### Cancellation, refund, earning reversal and payout ledger — read-only Production inspection

Inspected Production definitions for `request_customer_cancellation`, `request_talent_cancellation`, `admin_resolve_customer_cancellation_case`, `handle_booking_refund_financials`, `admin_process_refund`, `request_talent_payout`, `validate_payout_request_before_insert`, `allocate_payout_earnings_after_insert`, `handle_payout_status_update`, and payout/dispute guard triggers. Also inspected refund/payout/earning constraints and indexes. No function was invoked and no row was changed.

**Positive controls confirmed**
- Customer cancellation locks the booking row, verifies Customer ownership, allows only pre-session pending/paid/confirmed states, rejects sessions whose start time has arrived, and prevents duplicate cancellation cases.
- Customer cancellation policy is computed server-side from time remaining: >24 hours full automatic refund; 6–24 hours 50% automatic refund and the retained portion goes to Admin review; under 6 hours no automatic refund and the full retained amount goes to Admin review.
- Talent cancellation requires the authenticated Talent to own the booking and creates a full refund request before changing the booking status. The status guard independently checks that a full refund request exists.
- Cancellation/refund trigger holds Talent earnings while retained customer funds await Admin review. For full cancellation/refund, it reverses unallocated/unpaid Talent earnings and cancels referral rewards. It refuses to silently reverse earnings already allocated to a payout or paid out.
- Admin case resolution requires Finance permission, locks the case/booking/payment, requires automatic refunds to have been processed before deciding the retained amount, records Admin notes and decision history, and prevents refund reversal if earnings have already been allocated or paid.
- Refund provider references have a database-level unique partial index (`uq_refunds_provider_refund_id`), protecting against duplicate provider refund references even under concurrent requests.
- Payout requests have unique idempotency keys and provider references. The payout insert path locks the Talent profile and available earning rows, checks aggregate available balance, then atomically reserves exact earning allocations. If allocation cannot cover the entire payout, the insert transaction fails.
- Payout completion moves reserved allocations to paid-out amounts; rejected/failed payouts release the reserved amounts. Database CHECK constraints prevent allocated + paid-out totals from exceeding earning/reward amounts.
- A payout completion guard blocks settlement where any reserved source earning is in `disputed_hold`.

**P1/P2 — Talent cancellation lacks the explicit session-start time guard present in Customer cancellation**

`request_customer_cancellation` rejects cancellation once `bookings.start_time <= NOW()`. `request_talent_cancellation` checks ownership, booking status and escrow payment, but has no equivalent start-time check. Since `confirmed_by_talent` remains a cancellable state until the booking is moved to `in_progress`, a Talent may be able to cancel and initiate a full refund after the scheduled start time if the session-state transition has not yet occurred. The booking status guard does not enforce a time boundary either. Confirm the intended policy; if late Talent cancellation should instead be a support/dispute case, add a time guard and explicit post-start resolution path, then test in Staging. No Production change was made.

**Additional verification note**
- The current payout design uses manual provider settlement: Admin must supply a non-empty transfer reference before marking payout complete. This is a valid manual workflow, but the reference is an operator-entered assertion; it is not an automatic bank/provider confirmation. Reconciliation against bank statements remains an operational control outside these database functions.
- Refund and payout functions were inspected at definition/constraint level only. No concurrent transactions, actual bank transfers, or real user-role flows were simulated.

No database writes, migration applications, policy/function changes, or deployments were performed during this audit stage.


### Storage privacy and account lifecycle — read-only Production inspection

Inspected the live Storage bucket configuration, all storage.objects RLS policies, and the relevant account/admin authorization functions. Also compared the live Professional document-upload policy with the independent Professional Provider migrations on PR #287. No files were uploaded/downloaded, no policy/function was changed, and no account was modified.

**Storage inventory and positive controls**
- Production has 12 buckets. Public buckets are avatars, branding, hero, hero-slides, portfolios, promotions, and qris-payment-display. Private buckets include bank-transfer-payment-proofs, ktp-documents, professional-service-documents, qris-payment-proofs, and talent-media.
- KTP documents are private. The object policy scopes reads to the owner or an Admin allowed by can_admin_access_ktp; that helper maps Talent accounts to the Talent permission and Customer accounts to Support permission, and returns false for other account roles. Upload paths must be under the caller's UUID folder.
- Bank-transfer and QRIS proof buckets are private. Read access is limited to the submitting Customer or Finance Admin. Upload policies bind the object path to an eligible booking owned by the caller. Bank-transfer proof deletion is blocked while the submission is pending review.
- talent-media is a private bucket. Its read policy delegates to can_read_talent_media_object, which checks that the object path matches a talent_media row and permits approved media for publicly visible Talent, the owner, or authorized Admins.
- account_status_active_guard is a RESTRICTIVE policy on Storage objects for authenticated users, so it combines with the bucket-specific permissive policies rather than being bypassed by them.
- Public buckets expose object contents by design. Keep legal identity, KTP, payment proof, and private credentials out of public buckets; review any future use of avatars/portfolios to ensure uploaded content is genuinely intended for public display.

**P1 — Independent Professional Provider cannot upload required private documents in current Production**
- The live professional_service_documents_owner_upload policy requires the caller to have a matching row in talent_profiles, in addition to an active users account and a UUID-scoped object path.
- PR #287 introduces professional_provider_profiles and allows Professional-only application submission without a Talent profile, but the branch migrations inspected do not replace this Storage upload policy.
- Therefore, an independent Professional Provider without talent_profiles can satisfy the new profile/application model but cannot upload credential/supporting files to the private professional-service-documents bucket in Production. This is a concrete onboarding inconsistency, not evidence of unauthorized document disclosure.
- Remediation: add a migration that authorizes upload based on the active account plus the independent Professional Provider profile and UUID path, preserving owner/admin read boundaries and preventing overwrites of documents already referenced by an application. Resolve the migration timestamp collisions and test in Staging before applying anything.

**Account and Admin authorization controls**
- users RLS permits a user to read their own row; self-update is further protected by prevent_user_security_column_tampering. Ordinary users cannot change their role, ID, email, or creation timestamp. Changes to age-verification/account-status fields require the role-scoped KTP/Admin access check.
- A write guard blocks end-user writes from suspended/banned accounts across protected profile/identity tables. Its null-identity bypass is explicitly intended for trusted service-role/backend/cron operations; ordinary anonymous access remains subject to table RLS and grants.
- Admin permission checks resolve through private Admin account/permission tables and require an active Admin. Permission keys are allow-listed (talent, booking, finance, support); Super Admin receives the scoped permissions.
- Scoped Admin provisioning requires a service-role JWT and an active Super Admin inviter. Admin activation/deactivation and permission changes require Super Admin identity and create audit-log entries.
- These are source/definition-level controls. No authenticated JWT matrix, signup/deletion lifecycle, session revocation, or real role-transition test was run. The account lifecycle review is therefore not an end-to-end authorization certification.

No Storage objects, user records, Admin roles, RLS policies, functions, database settings, migrations, or deployments were changed during this audit stage.


### Merchant Partner workspace isolation — branch source review + Production schema check

Compared the four Merchant Partner migrations on PR #287 with the live Production public-schema catalog. The Merchant Partner schema is not present in Production at the time of inspection; no Merchant tables or Merchant RPCs were found there. The following controls are therefore a source review of draft branch migrations, not evidence of a deployed or Staging-tested workspace.

**Positive controls in the branch migrations**
- Business identity, memberships, locations, offers, and review histories are separate tables; Merchant Partner does not reuse Talent or Professional Provider identity tables.
- Client roles receive read-only table privileges. Business/member/location/offer writes are routed through SECURITY DEFINER RPCs with explicit caller identity and membership-role checks.
- Public business-directory reads expose only approved businesses. The owner_user_id column is excluded from client SELECT grants. Public location reads require an active location attached to an approved business.
- Membership reads are scoped to the current member or Admin. The raw membership table grants only limited columns; roster email disclosure is through a dedicated RPC and is returned only to the Owner, not Manager.
- Workspace access helper requires auth.uid(), an active YUKU account, an active membership, and an allowed role. The default allowed roles are Owner, Manager, and Staff; write RPCs narrow roles where needed.
- Invitations are Owner-only, limited to Manager/Staff, require an existing active YUKU account, and require the invitee to accept. Revocation is Owner-only and explicitly excludes the Owner membership. Invitation, acceptance, and revocation events are written to membership history.
- Manager/Staff membership does not permit editing the business identity. For an approved business, branch/location changes are Owner-only and return the business to needs_revision, removing its locations from public directory visibility until reviewed again.
- Merchant offers are informational promotions, explicitly funded/redeemed directly with the merchant. Only approved offers under an approved business are public; Owner submission and Admin review are separate steps. Editing an approved offer returns it to draft before it can be republished.
- Admin review RPCs require an authenticated Super Admin, and review decisions are recorded in dedicated history tables.

**Release evidence gaps**
- Since Merchant tables/RPCs are absent from Production, there is no live tenant-isolation test evidence yet. Do not advertise Merchant Partner as a live Production feature until migrations are reconciled, applied to Staging, and tested with separate business owners, managers, staff, invitees, unrelated users, anon, and Admin roles.
- The branch stack still contains duplicate migration version prefixes documented above. This blocks safe application of the Merchant migrations until the history and ordering are reconciled.
- Source review does not exercise concurrent invitations, membership revocation during active requests, owner/member lifecycle edge cases, or cross-business ID substitution. Add negative Staging tests for every write/read RPC using Business A credentials against Business B IDs.
- No direct checkout, escrow, payout, voucher balance, or YUKU commission is implemented by these Merchant offer migrations; redemption remains directly with the merchant, consistent with the current product scope.

No Merchant migration was applied to Production, and no Merchant table, policy, RPC, membership, offer, or business record was created or changed during this audit stage.


### Deployed Supabase Edge Functions and account lifecycle — live inventory/source inspection

Listed the Edge Functions deployed to the Production Supabase project and inspected the deployed source for account-management, admin-management, and yuku-push. This is deployed-source inspection, not a live HTTP penetration test.

**Production deployment inventory**
- Three functions are ACTIVE: account-management (version 1, JWT verification enabled), admin-management (version 3, JWT verification enabled), and yuku-push (version 4, JWT verification disabled but protected by its own request authentication).
- No xendit-webhook or create-checkout function is deployed in this project. The Xendit source reviewed earlier on PR #287 is therefore not a live Production integration. Do not represent Xendit checkout/webhook as active; keep the existing payment routes and provider rollout status explicit.

**Positive controls**
- account-management validates the bearer token with Supabase Auth getUser, requires an active actor, and checks get_admin_access.is_super_admin before exposing Customer/Talent account management.
- Its list/preflight actions are read-only. Preflight explicitly reports permanentDeletionEnabled=false; no permanent account deletion action is implemented in the deployed function.
- Status changes are limited to Customer/Talent accounts, disallow self-change and permanent-ban reactivation, require a reason, use an optimistic status predicate, and attempt compensating rollback if Auth ban or audit logging fails.
- admin-management validates the JWT and requires get_admin_access.is_super_admin before inviting an Admin. It allow-lists the four scoped permission keys, refuses to convert an existing Customer/Talent account into Admin, provisions the role/permissions through the service-only database RPC, and attempts to delete the newly invited Auth user if provisioning fails.
- yuku-push has JWT verification disabled at the platform layer, but its subscribe/unsubscribe actions validate the caller's bearer token with getUser; the send action requires the configured YUKU_PUSH_WEBHOOK_SECRET. It also checks the configured application origin when an Origin header is present. This is a custom-authenticated endpoint, not an unauthenticated public send API.

**Account suspension limitation**
- account-management sets a long Auth ban duration when an account is suspended and documents that already-issued access tokens remain valid until they expire. The source does not revoke all existing sessions as part of the status-change workflow.
- Protected table/Storage RLS and write guards add defense in depth, but SECURITY DEFINER RPCs can bypass ordinary RLS. Before launch, verify that every sensitive user-facing SECURITY DEFINER RPC independently rejects suspended/banned callers, or revoke their active sessions and test the exact behavior with a previously issued JWT.
- The function's rollback strategy is compensating rather than a single transaction across Auth, Postgres, and audit logging. It returns an explicit manual-intervention error if rollback fails; monitor and rehearse this failure path in Staging.

No Edge Function was deployed/replaced, no Auth user was invited/suspended/deleted, and no Production setting or database record was changed during this audit stage.


### KTP identity verification and Admin data isolation — read-only Production inspection

Inspected the KTP identity triggers and the private Admin authorization tables.

**Positive controls confirmed**
- KTP verification cannot be marked verified unless the account has a valid age-18+ date of birth, legal name, KTP storage path under the account's UUID folder, and a matching object owned by that account in the private ktp-documents bucket.
- Ordinary users cannot self-approve or alter KTP review status, rejection reason, verification timestamp, or reviewer identity. Legal identity fields become immutable to the owner while a submission is pending review or verified; rejected submissions can be resubmitted through the controlled path.
- Admin review capability is scoped by account type: Talent KTP review requires Talent permission; Customer KTP review requires Support permission. Other account roles do not receive KTP review access through this helper.
- private.admin_accounts and private.admin_permissions both have RLS enabled and FORCE ROW LEVEL SECURITY. The catalog inspection showed no client-role table grants; access is mediated through narrowly scoped SECURITY DEFINER authorization functions.

This remains a definition/privilege inspection. No KTP records or Admin permission rows were read or changed, and no real Admin/customer JWT test was performed.


### Suspended-account RPC and cross-account RLS review — read-only Production inspection

Reviewed the 130 public SECURITY DEFINER functions, EXECUTE grants, active-account write guard triggers, and row policies/column grants for core account, booking, payment, review, report, identity, and Professional application tables. This was catalog/source inspection only; no RPC was invoked with a real user token and no database state was changed.

**Suspended-account defense in depth**
- Of 130 public SECURITY DEFINER functions, 61 are executable by authenticated and 5 by anon. Counts are inventory metrics, not vulnerability counts.
- The private active-account write guard is attached to 46 public/Storage tables, including users, user_identities, talent/customer profiles, talent services/media, bookings, booking messages, booking history, payments, refunds, payout requests/allocations, earnings, cancellation cases, reports, reviews, notifications, and community content. It rejects writes when auth.uid() resolves to a user whose account status is neither active nor pending_verification.
- Core user-facing write RPCs that do not repeat an account-status predicate (for example booking route selection, completion confirmation, cancellation, bank-transfer proof submission, referral application, and Talent profile/service changes) write to guarded tables; the trigger aborts the transaction for a suspended caller. Their RPC definitions also constrain the affected row to the caller or booking participant.
- Professional application INSERT and revision UPDATE do not have the generic trigger, but their RLS WITH CHECK/USING predicates explicitly require the caller's account_status='active', the caller's own applicant_id, allowed workflow state, and valid category/delivery-mode configuration. The Admin review RPC separately requires active Super Admin or Talent permission.
- Admin RPCs that rely on has_admin_permission/is_super_admin inherit the active-Admin check from those helpers; examples include Finance payout/refund, Support report resolution, and Talent moderation. SECURITY DEFINER functions with no user identity are trigger/maintenance helpers, not evidence of anonymous RPC access.
- The account-management Edge Function's Auth ban does not immediately invalidate already-issued access tokens. The database guard/RLS is therefore an important second line of defense; it was verified in definitions, not with a previously issued suspended-user JWT.

**Cross-account read boundaries reviewed**
- users is self/Super Admin read; user_identities is owner or role-scoped KTP Admin read. KTP/legal identity fields are not made public by their table policy.
- customer_profiles is readable by the owner, Super Admin, or a Talent who has a booking relationship with that Customer. The table exposes only profile-style fields (display name, avatar, city, gender, bio, timestamps), not legal identity/KTP or bank data. Confirm product intent for Talent visibility after cancelled/expired bookings; the current policy is based on existence of a booking row, not active booking status.
- bookings, messages, status history, payments, cancellation cases, and refunds use participant ownership or permission-scoped Admin predicates. Message insert requires sender_id=auth.uid() and the caller to be a booking participant; update is limited to the other participant marking a message read.
- Reviews are public only when visible; insertion is tied to the caller as Customer and a trigger verifies the review's booking participants and completed status. Reports are visible to reporter or Support Admin.
- Professional application rows are owner-readable or Admin Talent/Super Admin-readable; status history is owner-through-parent or Admin-readable. No cross-applicant read path was identified in the inspected policies.

**Follow-up / limits**
- Confirm whether a Talent should retain Customer profile access after any historical booking, or only after a booking reaches an agreed state; this is a privacy/product decision, not a confirmed leak of high-risk data.
- Run a real JWT test matrix in Staging: active vs suspended previously issued tokens; Customer A vs Customer B; Talent A vs Talent B; booking participant vs unrelated user; Support vs Finance vs Talent Admin vs Super Admin; anon vs authenticated. Include direct table requests and RPC calls, not just UI flows.
- No confirmed cross-account exposure of KTP, legal identity, payment proof, payout/bank data, or internal Admin notes was found in the inspected RLS/column grants. This is not a certification of every table/function.

No Production records, functions, grants, policies, triggers, account states, or deployments were changed.


**Admin permission helper verification**
- private.is_active_admin requires a non-null target user, an active admin_accounts row, users.role='admin', and users.account_status='active'.
- private.has_admin_permission allow-lists only talent, booking, finance, and support, then requires an active Admin and either Super Admin level or the matching permission row.
- private.is_super_admin delegates to the active-Admin check before testing the Super Admin level. Thus deactivated Admin rows and suspended Admin accounts fail these permission helpers even if an access token remains valid.
- public.is_admin additionally returns true for a service_role JWT for trusted backend execution; the service-role key must remain server-side and must never be exposed to browsers/mobile clients.


### Cross-PR release-stack check — 27 November 2026

A follow-up inspection compared PR #284 (exact Social Experience service-ID foundation) with PR #287 (homepage, Provider, and Merchant Partner).

**New P0 — migration version collision across sibling PRs**
- PR #284 adds `20261127004000_social_experience_service_id_foundation.sql`.
- PR #287 adds `20261127004000_merchant_membership_management.sql`.
- Both PRs target `design/beranda-premium-compact` and are sibling branches; neither includes the other's migration.
- If both feature sets are integrated without renumbering and dependency review, Supabase receives duplicate migration version `20261127004000`. This is an additional cross-PR collision beyond the duplicate groups already inventoried inside PR #287.
- Do not resolve by blindly changing timestamps. Establish the intended order against the full canonical migration manifest and target Staging history, then assign unique versions and update dependent references/tests.

**PR #284 contract review**
- The draft adds nullable `bookings.service_id`, immutable service title/description snapshots, an exact-service booking RPC, and a compatibility path through the legacy `create_booking` RPC.
- It intentionally retains the one-service-per-Talent/category constraint; multi-offer per category is not enabled.
- Stage D SQL contains catalog/source-contract assertions for trigger ordering, financial snapshots, escrow, dispute, cancellation, refund, and payout safeguards. These are not runtime JWT, concurrency, or provider-webhook tests.
- The migration explicitly requires the full prior migration chain to be replayed in Staging first. PR #284 reports that the available Supabase main branch is `MIGRATIONS_FAILED` and no healthy Staging branch is available. Therefore its migration and Stage D checks remain unexecuted.

**Release decision**
- Keep PR #284 and #287 draft/unmerged until the migration chain is reconciled and a healthy disposable Staging environment is available.
- Treat the exact-service booking path as a required integration dependency before enabling the corresponding booking UI in a release.
- No migration, database change, merge, or deployment was performed by this follow-up review.


**Resolution update — cross-PR timestamp collision (27 Nov 2026)**
- PR #284 has been updated: its Social Experience migration is now `20261127006000_social_experience_service_id_foundation.sql`; the colliding `20261127004000_social_experience_service_id_foundation.sql` path was removed from that branch.
- This removes the direct duplicate version with PR #287's Merchant membership-management migration (`20261127004000`).
- Required release order remains explicit: integrate/reconcile PR #287's canonical migration chain (Merchant membership foundation/review/management/offers through `05000`) before applying PR #284's Social Experience migration `06000`.
- This is a source-branch correction only. It does not validate the complete migration chain or substitute for a clean Staging replay; all PRs remain draft and no database was changed.


**Staging provisioning constraint — 27 Nov 2026**
- A fresh Supabase development branch is created by applying the migrations from the parent project; it is not an empty database that bypasses the parent migration chain.
- The connected project currently exposes only its default `main` branch, whose status is `MIGRATIONS_FAILED`. Creating a child branch from this state is not a safe shortcut: the branch provisioning flow would attempt to apply the same parent migration history and may reproduce the failure before feature migrations can be tested.
- No branch was created. Branch creation can incur hourly compute charges and requires cost disclosure/approval; it must also wait until the parent migration chain is repaired or a separate clean disposable Supabase project is provisioned.
- Safe next step: identify the exact failed migration/error in the parent branch's deployment history, reconcile its migration source/history without touching Production, then provision a clean disposable Staging target and replay the canonical chain. If the parent is Production, do not repair it as a staging exercise; use a separate project instead.
- This is a provisioning/dependency finding, not a claim that any feature migration has passed SQL execution. No database, migration history, or deployment was changed.


**Production runtime/schema mismatch observed from read-only logs — 27 Nov 2026**
- PostgreSQL error logs include repeated `column talent_services.custom_title does not exist` errors (SQLSTATE `42703`) on 26 Nov 2026.
- A read-only `information_schema.columns` inspection confirms Production `public.talent_services` currently has `id`, `talent_id`, `activity_category_id`, `custom_rate_override`, `created_at`, `approval_status`, `is_active`, `reviewed_by`, `reviewed_at`, `review_note`, and `updated_at`; it does not have `custom_title` or `custom_description`.
- The feature branch migration that adds these columns is `20261127005500_talent_custom_social_experience_services.sql`. Its former `03000` version collided with Merchant directory migration `20261127003000_merchant_admin_review_and_directory.sql`; it has now been moved to `05500`, after Merchant offers `05000` and before Social Experience booking foundation `06000`. The old migration path was removed from the branch and the canonical manifest updated.
- This is a release-order/source fix only. It does not apply the schema change to Production. Do not deploy frontend code that selects these fields until the corresponding migration has passed clean Staging replay and is released in the coordinated order.
- Other log errors include `permission denied for function can_admin_access_ktp` and `permission denied for table customer_profiles`; these require actor/JWT-path tracing before changing grants or RLS. No permission change is authorized by this log observation.
- The log sample is from the Production project and does not reveal the exact migration failure recorded by Supabase's branch provisioning status. Do not conflate runtime query errors with a failed migration record.
- All checks here were read-only. No Production DDL/DML, migration, or deployment was performed.
