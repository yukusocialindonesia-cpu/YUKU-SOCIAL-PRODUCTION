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
