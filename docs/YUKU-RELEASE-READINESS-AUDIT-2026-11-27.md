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
