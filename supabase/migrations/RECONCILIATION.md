# Supabase migration reconciliation

Snapshot: 2026-11-26
Target checked: YUKU Production project `sbqvltqzzcsqzijgumld`
Purpose: track repository filenames against the Supabase migration history without executing SQL.

## Result

- Production migration history entries: 107
- Local migration SQL files: 125
- Entries with a local file matched by normalized migration name and aligned to the recorded version: 74
- Production entries still missing a confidently matched local SQL file: 33
- Local SQL files not represented by the exact Production version: 51

A name match is not a checksum match. File renames do not prove that SQL contents are identical to what was applied. Do not use this report as authorization to run `supabase db push`, repair migration history, or apply SQL to Production.

## Production history entries without a confidently matched local SQL file

| Version | Recorded migration name |
|---|---|
| 20261117221618 | 41_security_hardening_function_execute_cleanup |
| 20261117221626 | security_harden_function_execute_privileges |
| 20261117221638 | security_harden_public_security_definers |
| 20261117221711 | security_harden_promotions_trigger_search_path |
| 20261117221742 | tighten_security_definer_public_access |
| 20261117221941 | harden_refund_insert_ownership_guard |
| 20261117222112 | restore_payout_dispute_guard_trigger |
| 20261117223751 | yuku_admin_verification_audit_trail |
| 20261117223826 | yuku_admin_payout_audit_trail |
| 20261117232119 | refund_ledger_reversal_and_idempotency_guard_20261118 |
| 20261117232240 | add_secure_talent_payout_request_rpc_20261118 |
| 20261118041702 | remove_duplicate_refund_provider_index_20261118 |
| 20261118041712 | tighten_public_talent_visibility_rpc_20261118 |
| 20261118074837 | recreate_hero_slides_match_app_schema |
| 20261118075100 | create_hero_bucket_match_staging |
| 20261118075952 | harden_payout_reports_customer_cancellation |
| 20261118083617 | grant_anon_execute_is_admin |
| 20261118083836 | grant_anon_execute_is_talent_publicly_visible |
| 20261118084050 | grant_authenticated_execute_is_talent_publicly_visible |
| 20261118085044 | seed_activity_categories_from_staging |
| 20261118091131 | allow_ktp_review_without_manual_nik |
| 20261118163142 | create_booking_enforce_category_mode_and_approved_services |
| 20261119050058 | add_booking_status_history_trigger_20261119 |
| 20261119050104 | move_extensions_to_extensions_schema_20261119 |
| 20261119050111 | storage_owner_delete_policies_and_avatar_limit_20261119 |
| 20261119050122 | add_missing_foreign_key_indexes_20261119 |
| 20261119050505 | add_site_branding_and_branding_bucket_20261119 |
| 20261119145643 | require_approved_service_for_public_talent_visibility |
| 20261119150818 | separate_talent_profile_approval |
| 20261120154123 | notifications_realtime_publication |
| 20261120165901 | restrict_notification_trigger_function_execute |
| 20261120185544 | enable_pg_net_for_push_webhook |
| 20261121115043 | fix_payout_number_length |

## Next safe steps

1. Recover each missing SQL file from the original source commit, deployment artifact, or verified backup.
2. Compare recovered SQL to the applied migration contents or deployment record.
3. Verify local-only migrations one by one against schema state and deployment records.
4. Identify the intended Preview project and reconcile its migration history independently.
5. Only after full verification, run a controlled staging replay. Production changes require separate explicit approval.
