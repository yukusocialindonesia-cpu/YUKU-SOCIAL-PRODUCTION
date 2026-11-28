# YUKU Supabase Migration Recovery — 28 Nov 2026

## Current result

Target: Production project `sbqvltqzzcsqzijgumld`.

- Production migration ledger: **150 entries** (143 timestamped + 7 legacy).
- Recovery branch: `fix/supabase-migration-history-recovery`.
- Exact canonical local files for Production ledger entries: **150/150**.
- Remote ledger entries without an exact local filename: **0**.
- Duplicate 14-digit version prefixes in the recovery branch: **0**.
- Timestamped local migrations not present in Production ledger: **24**.
- Legacy non-timestamped local SQL files (28, 29, 30, 32, 33, 35–39, 43) remain outside the active timestamped migration chain and have not been renamed or replayed.

The exact 150/150 result is a filename/version reconciliation against the Production migration ledger. It does **not** prove the 24 branch-only migrations are safe to apply.

## Remaining branch-only migrations

### Core security, policy, and behavior changes (13)

```text
20261126174000_lock_professional_application_revision_fields.sql
20261126181000_protect_verification_attestation_fields.sql
20261126185000_refine_professional_service_verification_levels.sql
20261126190050_harden_payout_request_insert_access.sql
20261126200000_restrict_booking_chat_by_status.sql
20261126230000_harden_qris_proof_upload_and_trigger_acl.sql
20261126235000_enforce_professional_service_rate_bounds.sql
20261126235900_allow_super_admin_talent_profile_review.sql
20261127000100_professional_service_public_visibility_helper.sql
20261127000500_narrow_scoped_admin_booking_trigger_bypass.sql
20261127000600_scope_admin_summary_rpcs.sql
20261127000900_allow_self_service_customer_to_talent_transition.sql
20261127001900_finalize_social_experience_taxonomy.sql
```

These are not in the Production migration ledger. Read-only checks found several meaningful differences from the current Production schema/policies, including the QRIS proof policy missing the manual-QRIS route lock and pending-review duplicate guard, broad Admin bypasses in booking trigger functions, and Admin summary RPCs with broader result scope. Keep these as pending changes until reviewed and regression-tested; do not blindly replay them.

### Professional Provider architecture (7)

```text
20261127001400_professional_provider_identity_decoupling.sql
20261127001500_harden_professional_application_revision_attestation_fields.sql
20261127006000_decouple_professional_review_and_publication.sql
20261127007000_derive_professional_profile_completeness.sql
20261127008000_prevent_professional_public_rls_recursion.sql
20261127009000_allow_independent_professional_document_uploads.sql
20261127010000_allow_super_admin_professional_profile_review.sql
```

These depend on the new `professional_provider_profiles` model, which is **not present in Production**. Keep the sequence together and do not deploy to Production until the full provider-only application, review, publication, Storage, and RLS/JWT flows are tested.

### Merchant Partner (4)

```text
20261127002000_merchant_partner_membership_foundation.sql
20261127003100_merchant_admin_review_and_directory.sql
20261127004100_merchant_membership_management.sql
20261127005100_merchant_offers_directory.sql
```

The Merchant tables and RPCs are **not present in Production**. Dependency order is foundation → admin review/directory → membership management → offers. The repository's Merchant preflight must be run only after these migrations have been applied to an isolated staging project and the full role/JWT and cross-tenant tests are complete.

## Superseded or duplicate local files removed from the active replay chain

The recovery branch removes aliases or local files whose effects are already represented by exact Production migrations, already present in the live schema, or superseded by a stricter Production implementation. Examples include:
- duplicate aliases for scoped Admin invitation, public Talent availability, admin RLS helper grants, and active-account session enforcement;
- old public profile column grants superseded by `20261128050831`;
- old Social Experience custom-service versions superseded by `20261127181144`;
- old KTP selfie-path alias superseded by `20261127181241`;
- duplicate trigger-helper EXECUTE revocations already reflected in live privileges;
- older professional revision/public visibility and application-insert policies that would weaken the current Production policies;
- obsolete KTP evidence guard that conflicts with the later legacy-verified identity guard and the Production rule allowing KTP review without manually supplied NIK;
- redundant index, bucket, availability-policy, and notification-policy files whose effects are already present.

The exact Production SQL files were restored from `supabase_migrations.schema_migrations`; applied historical files were not edited to change their SQL.

## Verification and safety boundary

- The latest read-only comparison found all 150 Production ledger versions represented by exact canonical filenames in this branch.
- Production schema, data, and migration history were **not changed** by this recovery work.
- No `db push`, migration repair, reset, rebase, or Production DDL/DML was run.
- Supabase Preview branch `main` was still reported as `MIGRATIONS_FAILED` at the last status check. A fresh successful replay has **not** been observed.
- Do not merge this branch to `main` or run the 24 pending migrations on Production until a disposable staging replay and the required regression tests pass.

## Next validation

1. Re-run the Supabase branch migration workflow after the canonical recovery is reviewed.
2. Confirm the original missing-remote-version error is gone.
3. Validate the 24 pending migrations in dependency order on a disposable environment.
4. Run RLS/JWT, Storage, booking/chat, QRIS, payout, professional-provider, and Merchant regression tests.
5. Prepare a separate Production change set only for migrations explicitly approved for release.
