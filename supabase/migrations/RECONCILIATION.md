# Supabase migration reconciliation

Snapshot: 2026-11-27 (live read-only comparison)
Target checked: YUKU Production project `sbqvltqzzcsqzijgumld`
Branch reviewed: `chore/reconcile-supabase-migration-history`
Purpose: compare repository migration filenames with the actual Supabase migration history. No SQL was executed.

## Current result

- Production migration history entries: **129**
- Latest Production migration version: **20261126124423** (`harden_professional_application_revision_attestation_fields`)
- Local migration SQL files on this PR branch: **125**
- Files matched to Production by exact version or normalized migration name: **74**
- Production entries without a confidently matched local SQL file: **55**
- Local files whose version prefix is not present in Production: **51**

This live result supersedes the 26 November snapshot counts previously recorded below in this document and README. A name match is not a checksum match. File renames do not prove that SQL contents are identical to what was applied.

## Filename-shape audit (27 November 2026)

A separate listing of the complete `supabase/migrations/` directory on this PR branch confirms 125 SQL files:
- 107 filenames use a 14-digit timestamp prefix.
- 18 filenames use legacy two-digit prefixes (`01`–`07`, `28`–`30`, `32)–`33`, `35`–`39`, and `43`).
- The seven `01`–`07` versions exist in the Production ledger. The other eleven short-prefix files do not have matching short versions in the current Production ledger and remain part of the 51 local-only files requiring classification.
- No duplicate 14-digit filename prefixes were found in this branch's migration directory.

This is a filename inventory only. It does not establish whether any of the eleven legacy SQL files were applied under a different remote version/name, or whether their SQL is safe to replay. Do not rename them to guessed timestamps. Recover deployment history or compare their SQL effects with the live schema first.

## Production entries without a confidently matched local SQL file

| Version | Recorded migration name |
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

## Next safe steps

1. Recover each missing SQL file from the original source commit, deployment artifact, or verified backup.
2. Compare recovered SQL to the applied migration contents or deployment record.
3. Verify local-only migrations one by one against schema state and deployment records.
4. Reconcile the 51 local-only files individually as new/unapplied, historical mismatch, or duplicate/superseded.
5. Inspect checksums/content and migration dependencies before staging replay.
6. Keep Production read-only until the owner explicitly approves a separately reviewed migration plan.

**Do not run** `supabase db push`, `migration repair`, or apply SQL to Production based on this report.