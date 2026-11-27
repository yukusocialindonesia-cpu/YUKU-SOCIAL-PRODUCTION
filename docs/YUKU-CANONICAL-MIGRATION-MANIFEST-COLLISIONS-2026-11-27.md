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


## Full repository / Production reconciliation checkpoint — 27 November 2026

A separate reconciliation PR was inspected and its reported snapshot was compared with the live Production history.

### Verified branch relationship

- PR #265 (`chore/reconcile-supabase-migration-history`) is **open**, not merged, and targets `main`.
- PR #287 (`design/beranda-brand-promise-v2`) is **open Draft** and targets `design/beranda-premium-compact`.
- Therefore PR #265's timestamp renames are **not part of PR #287's base branch by inheritance**. Do not assume the current feature branch has the historical rename reconciliation.
- PR #265 reports 125 SQL files on its own branch; PR #287's current branch has 143 SQL files. The 18-file difference is not a direct count of new deployable migrations: it includes the branch's current feature work and duplicate-prefix additions.

### Current live Production checkpoint

- Production history: **129** records.
- Latest version: `20261126124423` — `harden_professional_application_revision_attestation_fields`.
- Current feature branch: **143** SQL files.
- Duplicate version-prefix groups in the current feature branch: **8**.
- PR #265's reconciliation snapshot: 74 matched Production entries, 55 Production entries without a confidently matched local SQL file, and 51 local files whose version prefix is not present in Production.
- These 74/55/51 counts belong to PR #265's 125-file reconciliation branch and must not be silently projected onto the 143-file feature branch.

### The 55 unmatched Production records

PR #265's `supabase/migrations/RECONCILIATION.md` lists these records without a confidently matched local SQL file:

| Version | Recorded name |
|---|---|
| `20261117221618` | `41_security_hardening_function_execute_cleanup` |
| `20261117221626` | `security_harden_function_execute_privileges` |
| `20261117221638` | `security_harden_public_security_definers` |
| `20261117221711` | `security_harden_promotions_trigger_search_path` |
| `20261117221742` | `tighten_security_definer_public_access` |
| `20261117221941` | `harden_refund_insert_ownership_guard` |
| `20261117222112` | `restore_payout_dispute_guard_trigger` |
| `20261117223751` | `yuku_admin_verification_audit_trail` |
| `20261117223826` | `yuku_admin_payout_audit_trail` |
| `20261117232119` | `refund_ledger_reversal_and_idempotency_guard_20261118` |
| `20261117232240` | `add_secure_talent_payout_request_rpc_20261118` |
| `20261118041702` | `remove_duplicate_refund_provider_index_20261118` |
| `20261118041712` | `tighten_public_talent_visibility_rpc_20261118` |
| `20261118074837` | `recreate_hero_slides_match_app_schema` |
| `20261118075100` | `create_hero_bucket_match_staging` |
| `20261118075952` | `harden_payout_reports_customer_cancellation` |
| `20261118083617` | `grant_anon_execute_is_admin` |
| `20261118083836` | `grant_anon_execute_is_talent_publicly_visible` |
| `20261118084050` | `grant_authenticated_execute_is_talent_publicly_visible` |
| `20261118085044` | `seed_activity_categories_from_staging` |
| `20261118091131` | `allow_ktp_review_without_manual_nik` |
| `20261118163142` | `create_booking_enforce_category_mode_and_approved_services` |
| `20261119050058` | `add_booking_status_history_trigger_20261119` |
| `20261119050104` | `move_extensions_to_extensions_schema_20261119` |
| `20261119050111` | `storage_owner_delete_policies_and_avatar_limit_20261119` |
| `20261119050122` | `add_missing_foreign_key_indexes_20261119` |
| `20261119050505` | `add_site_branding_and_branding_bucket_20261119` |
| `20261119145643` | `require_approved_service_for_public_talent_visibility` |
| `20261119150818` | `separate_talent_profile_approval` |
| `20261120154123` | `notifications_realtime_publication` |
| `20261120165901` | `restrict_notification_trigger_function_execute` |
| `20261120185544` | `enable_pg_net_for_push_webhook` |
| `20261121115043` | `fix_payout_number_length` |
| `20261126123841` | `20261126120000_professional_services_taxonomy` |
| `20261126123843` | `20261126133000_professional_talent_services` |
| `20261126123845` | `20261126143000_professional_service_applications` |
| `20261126123847` | `20261126153000_admin_review_professional_service_application` |
| `20261126123849` | `20261126162000_enforce_professional_service_delivery_modes` |
| `20261126123851` | `20261126173000_suspend_listing_when_application_needs_action` |
| `20261126123853` | `20261126180000_require_professional_verification_attestation` |
| `20261126123855` | `20261126182000_professional_service_application_notifications` |
| `20261126123857` | `20261126183000_professional_service_application_status_history` |
| `20261126123859` | `20261126184000_guard_professional_service_provider_eligibility` |
| `20261126123903` | `20261126235700_require_active_account_for_professional_listings` |
| `20261126123932` | `grant_professional_service_data_api_roles` |
| `20261126124016` | `fix_professional_listing_public_account_gate` |
| `20261126124312` | `20261126160000_harden_professional_service_application_security` |
| `20261126124314` | `20261126175000_allow_super_admin_professional_service_review` |
| `20261126124316` | `20261126180000_require_professional_verification_attestation` |
| `20261126124319` | `20261126184000_guard_professional_service_provider_eligibility` |
| `20261126124320` | `20261126235700_require_active_account_for_professional_listings` |
| `20261126124323` | `20261126235800_allow_super_admin_professional_document_review` |
| `20261126124325` | `20261127000200_restrict_professional_document_uploads` |
| `20261126124333` | `restore_private_active_provider_gate_after_policy_hardening` |
| `20261126124423` | `harden_professional_application_revision_attestation_fields` |

### Current decision

1. Do not merge PR #265 into the feature branch by assumption; first reconcile the PR bases and determine the intended integration route.
2. Recover the 55 historical SQL sources from original commits, deployment artifacts, or verified backups. Do not create guessed placeholder files.
3. Compare recovered SQL with current Production function/policy/trigger definitions and deployment records.
4. Classify every local-only file on the feature branch, especially the Professional Provider, Merchant, Talent Social Experience, payment, and payout changes.
5. Do not run `db push`, `migration repair`, or Production SQL while any source/version mapping remains unknown.

Reference: [PR #265 reconciliation](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/265), [PR #287 feature branch](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/287), [PR #265 reconciliation manifest](https://github.com/yukusocialindonesia-cpu/YUKU-id/blob/chore/reconcile-supabase-migration-history/supabase/migrations/RECONCILIATION.md).


## Filename-level normalization audit on the 143-file feature branch — 27 November 2026

A second, deliberately conservative comparison was run directly against the current `design/beranda-brand-promise-v2` migration directory and the live 129-entry Production history. The comparison strips a local version prefix, an optional `yuku_` prefix, and legacy numeric/timestamp prefixes from either side. It compares **names only**; it does not inspect or prove SQL equivalence. This normalization supersedes the earlier draft calculation in this section.

| Result | Count | Meaning |
|---|---:|---|
| Unique normalized-name candidates | 88 | One Production record has the same normalized descriptive name |
| Ambiguous candidates | 3 | The same normalized name exists more than once in Production |
| No normalized-name candidate | 52 | No direct normalized-name pair found |
| Current feature-branch SQL files | 143 | Full folder count |
| Production migration history records | 129 | Live read-only count |

On the Production side, **35 of 129 records** have no normalized-name candidate in the current 143-file branch. These are not necessarily missing applied SQL: some may be out-of-band changes, deleted historical sources, or changes subsumed by later migrations. The 35 records are enumerated in the PR #265 reconciliation report; source recovery and object-level comparison remain required.

The three ambiguous names are:
- `require_professional_verification_attestation`: Production versions `20261126123853` and `20261126124316`.
- `guard_professional_service_provider_eligibility`: Production versions `20261126123859` and `20261126124319`.
- `require_active_account_for_professional_listings`: Production versions `20261126123903` and `20261126124320`.

These duplicate Production names are not automatically duplicate SQL: they may be repeated revisions/records. Their exact SQL and resulting schema effects need provenance review before a one-to-one file mapping can be chosen.

### Important correction to interpretation

- The earlier 74 matched / 55 missing / 51 local-only figures belong to the **125-file PR #265 reconciliation branch** and its documented matching method.
- The 64 / 3 ambiguous / 76 no-candidate figures above are a separate **143-file PR #287 feature-branch filename comparison**.
- Neither count is a SQL checksum or byte-for-byte verification. A name match is only a candidate mapping.
- Several local-only files are recent feature migrations (Professional Provider, Merchant Partner, and Social Experience) and should be treated as unapproved/unapplied until separately tested. A prefix not found in Production is not permission to push it.
- Some historical migration sources may exist only in older commits, deployment records, or out-of-band SQL execution; no source file should be fabricated to fill a gap.

### Next verification priorities

1. Recover source SQL for Production records that have no local candidate from original commits, deployment artifacts, or verified backups.
2. For the 64 candidate matches, compare exact SQL source where available and inspect live object definitions for function, trigger, policy, grant, index, and constraint changes.
3. Resolve the three ambiguous duplicate-name records by source provenance and chronology.
4. Review the 76 no-candidate files for historical rename, new feature, superseded change, or manual SQL provenance.
5. Build a canonical staging replay plan only after these classifications and a healthy non-Production target are available.
6. Keep Production read-only; no migration SQL, history repair, or deployment action is authorized by this audit.


### Audit correction — legacy numeric prefixes

The first pass of this feature-branch normalization did not strip the legacy two-digit sequence prefix on the Production side (for example, `yuku_08_...`). That undercounted candidate matches. The corrected normalization strips these numeric prefixes from both sides and yields **88 unique candidates, 3 ambiguous local files, and 52 local files with no candidate**. The Production-side unmatched count is **35**. The counts above are the corrected snapshot; all are filename-only candidates, not SQL equivalence claims.
