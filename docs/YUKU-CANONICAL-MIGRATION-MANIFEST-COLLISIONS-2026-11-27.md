# YUKU — Canonical Migration Manifest (collision subset)
Tanggal pemeriksaan: 27 November 2026
Repository: `yukusocialindonesia-cpu/YUKU-id`
Branch: `design/beranda-brand-promise-v2`
Supabase target checked read-only: `yukuproduction` / `sbqvltqzzcsqzijgumld`
Project status at check: `ACTIVE_HEALTHY`, PostgreSQL 17.12
Method: current GitHub migration filenames + SQL inspection for all 17 files in 8 duplicate-prefix groups + live Supabase migration history read.

> This is a **collision-subset manifest**, not a complete manifest for all 143 repository SQL files. It is not a migration execution plan. No SQL, migration history, schema, or data was changed.

## Production checkpoint

- Live Production migration history returned **129 records**.
- Latest recorded Production version: `20261126124423` — `harden_professional_application_revision_attestation_fields`.
- No Production migration version starts with `20261127`.
- Production contains the two Admin changes represented by the legacy `62_*.sql` filenames, under unique timestamp versions:
  - `20261121081549` — `62_scoped_admin_trigger_guard_hardening`
  - `20261121081552` — `62_index_admin_audit_actor_foreign_keys`

This corrects older repository notes that reported 107 Production records; the current read-only query returned 129 at this check. The live result is authoritative for the time of this check.

## Status definitions

- `APPLIED_MATCHED_PRODUCTION`: Production history contains the matching recorded migration name and mapped timestamp. Do not replay it.
- `BRANCH_ONLY_NOT_IN_PRODUCTION`: no matching version/name was found in current Production history; treat as unapplied until proven otherwise.
- `SUPERSEDED_DO_NOT_REPLAY`: later branch implementation appears to replace this draft phase. Keep Git history, but exclude from any replay set only after final dependency review.
- `REVIEW_REQUIRED`: insufficient evidence to safely classify.

## Manifest

| Current file | Production mapping | Status | Notes |
|---|---|---|---|
| `62_scoped_admin_trigger_guard_hardening.sql` | `20261121081549` | `APPLIED_MATCHED_PRODUCTION` | Exact recorded name in live history; do not replay under version 62. |
| `62_index_admin_audit_actor_foreign_keys.sql` | `20261121081552` | `APPLIED_MATCHED_PRODUCTION` | Exact recorded name in live history; do not replay under version 62. |
| `20261126190000_grant_professional_service_data_api_roles.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Grants target Professional Services objects; review object existence and least-privilege grants in staging. |
| `20261126190000_harden_payout_request_insert_access.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Payout security hardening; must be tested against existing payout RPC and grants before rollout. |
| `20261127000700_professional_provider_identity_decoupling.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Full independent Provider path; table, listing FK, policies, review RPC and publication gate changes. |
| `20261127000700_remove_legacy_public_talent_services_policy.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Removes permissive legacy Talent services policy; independently review public read behavior. |
| `20261127001000_harden_professional_application_revision_attestation_fields.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Depends on independent Provider profile from `00700_professional_provider_identity_decoupling`. |
| `20261127001000_link_talent_selfie_evidence_and_guard_approval.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Adds identity evidence field and verification/sanction guards; test against current verification flow. |
| `20261127001000_stop_leaking_internal_report_notes.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Notification privacy change; check trigger/function replacement against current production function definition. |
| `20261127002000_finalize_social_experience_taxonomy.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Data updates to category taxonomy; validate IDs and existing catalog values before staging. |
| `20261127002000_merchant_partner_membership_foundation.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Merchant businesses, memberships, locations, helper functions and policies; foundation migration. |
| `20261127003000_merchant_admin_review_and_directory.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Depends on Merchant foundation tables and review lifecycle. |
| `20261127003000_talent_custom_social_experience_services.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Alters Talent service fields and request RPC; separate from Merchant and Provider domains. |
| `20261127004000_create_independent_professional_provider_profiles.sql` | none | `SUPERSEDED_DO_NOT_REPLAY` | Phase A version of the Provider table; conflicts with the fuller `00700` path. Its `IF NOT EXISTS` table creation does not add missing review columns. |
| `20261127004000_merchant_membership_management.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Depends on Merchant foundation and membership tables; includes invitation, roster and history RPCs. |
| `20261127005000_allow_professional_only_applications.sql` | none | `SUPERSEDED_DO_NOT_REPLAY` | Phase B policy replacement appears weaker than the checks introduced by the full `00700` implementation; do not run after it. |
| `20261127005000_merchant_offers_directory.sql` | none | `BRANCH_ONLY_NOT_IN_PRODUCTION` | Depends on Merchant foundation, membership/review helpers and approved-business state. |

## Totals for these 17 collision files

| Status | Count |
|---|---:|
| `APPLIED_MATCHED_PRODUCTION` | 2 |
| `BRANCH_ONLY_NOT_IN_PRODUCTION` | 13 |
| `SUPERSEDED_DO_NOT_REPLAY` | 2 |
| **Total** | **17** |

## Canonical version decisions

1. Never use short version `62` as a new pending migration. The two changes already exist in Production under `20261121081549` and `20261121081552`.
2. The future timestamp collision groups must be assigned unique, monotonically increasing version identifiers before a canonical replay set can be built. Do not rename files already applied to any environment.
3. Do not keep both Provider profile creation phases in a replay chain. Resolve the intended single implementation and test it against the current Production schema in an isolated staging environment.
4. Do not replay the Phase B Professional application policy after the full Provider decoupling implementation unless a reviewed replacement preserves every existing age/KTP/attestation restriction.
5. The 13 branch-only files are **not approved to apply** merely because they are absent from Production history. They still require SQL review, dependency ordering, staging replay and JWT/RLS tests.

## Remaining work before a full canonical manifest

- Enumerate and classify the other 126 migration files in the repository against all 129 Production records.
- Compare the SQL definitions for all historic mismatches; filename similarity is not proof of equivalent SQL.
- Verify out-of-band SQL Editor changes against live schema objects and record their provenance.
- Confirm a disposable/staging database and its project ref before any replay.
- Run the Professional-only application flow, Talent regression, Merchant cross-tenant RLS/JWT matrix, concurrency tests, and payout regression in staging.
- Keep Production untouched until explicit approval.

## Evidence

- Live Supabase migration history read on 27 November 2026 (read-only).
- GitHub source files in `supabase/migrations/` on `design/beranda-brand-promise-v2`.
- Collision analysis: [YUKU Migration Collision Audit](./YUKU-MIGRATION-COLLISION-AUDIT-2026-11-27.md)
- Historical reconciliation PR: https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/265
- Current implementation PR: https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/287
