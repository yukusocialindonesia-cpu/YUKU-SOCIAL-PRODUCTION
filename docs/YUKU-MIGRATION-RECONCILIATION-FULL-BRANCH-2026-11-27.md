# YUKU — Full Migration Filename Reconciliation (Feature Branch)

Snapshot: 27 November 2026  
Repository: `yukusocialindonesia-cpu/YUKU-id`  
Branch: `design/beranda-brand-promise-v2`  
Target checked read-only: Supabase Production `sbqvltqzzcsqzijgumld` (`yukuproduction`)  
Scope: filename normalization only. No SQL was executed.

## Summary

| Classification | Count |
|---|---:|
| SQL files in feature branch | 143 |
| Production migration history records | 129 |
| Unique normalized-name candidates | 88 |
| Ambiguous local filenames | 3 |
| Local files with no normalized-name candidate | 52 |
| Production records with no normalized-name candidate | 35 |

Normalization strips `.sql`, a leading `yuku_`, and up to three leading numeric/timestamp prefixes from either side. This is a **candidate mapping by descriptive name only**. It does not prove SQL byte equality, equivalent behavior, or that a file is safe to replay.

## Unique normalized-name candidates (88)

| Local file | Production version | Production recorded name |
|---|---|---|
| `01_initial_schema_and_enums.sql` | `01` | `initial_schema_and_enums` |
| `02_services_and_availability.sql` | `02` | `services_and_availability` |
| `03_bookings_and_escrow_schema.sql` | `03` | `bookings_and_escrow_schema` |
| `04_financial_ledgers_and_referrals.sql` | `04` | `financial_ledgers_and_referrals` |
| `05_reviews_reports_and_system.sql` | `05` | `reviews_reports_and_system` |
| `06_triggers_functions_and_rls.sql` | `06` | `triggers_functions_and_rls` |
| `07_fix_grants_and_actor_type.sql` | `07` | `fix_grants_and_actor_type` |
| `08_grant_additional_features.sql` | `20261117181023` | `yuku_08_grant_additional_features` |
| `09_admin_management_rpcs.sql` | `20261117181049` | `yuku_09_admin_management_rpcs` |
| `10_escrow_completion_and_payment_fixes.sql` | `20261117181121` | `yuku_10_escrow_completion_and_payment_fixes` |
| `11_reviews_rating_sync.sql` | `20261117181130` | `yuku_11_reviews_rating_sync` |
| `12_reports_admin_moderation.sql` | `20261117181145` | `yuku_12_reports_admin_moderation` |
| `13_auto_notifications_triggers.sql` | `20261117181513` | `yuku_13_auto_notifications_triggers` |
| `14_referral_helpers.sql` | `20261117181532` | `yuku_14_referral_helpers` |
| `15_promotions.sql` | `20261117181545` | `yuku_15_promotions` |
| `16_talent_media_gallery.sql` | `20261117181559` | `yuku_16_talent_media_gallery` |
| `17_booking_chat_messages.sql` | `20261117181610` | `yuku_17_booking_chat_messages` |
| `18_security_and_payout_guardrails.sql` | `20261117181639` | `yuku_18_security_and_payout_guardrails` |
| `19_create_booking_rpc.sql` | `20261117181946` | `yuku_19_create_booking_rpc` |
| `20261121020000_create_push_subscriptions.sql` | `20261120185433` | `create_push_subscriptions` |
| `20261121021500_add_yuku_push_notification_webhook.sql` | `20261120185621` | `add_yuku_push_notification_webhook` |
| `20261121105125_community_mvp.sql` | `20261121105125` | `community_mvp` |
| `20261121105216_community_moderation_helper_private.sql` | `20261121105216` | `community_moderation_helper_private` |
| `20261121105232_community_fk_indexes.sql` | `20261121105232` | `community_fk_indexes` |
| `20261121110017_fix_activity_categories_anon_read.sql` | `20261121110017` | `fix_activity_categories_anon_read` |
| `20261121110823_allow_public_rls_permission_checks.sql` | `20261121110823` | `allow_public_rls_permission_checks` |
| `20261124081950_enforce_active_account_sessions.sql` | `20261124081950` | `20261124120000_enforce_active_account_sessions` |
| `20261124150000_public_talent_availability_read.sql` | `20261124084839` | `public_talent_availability_read` |
| `20261124165900_add_manual_bank_transfer_provider.sql` | `20261124144625` | `add_manual_bank_transfer_provider` |
| `20261124170000_manual_bank_transfer_workflow.sql` | `20261124144632` | `manual_bank_transfer_workflow` |
| `20261124171000_protect_pending_bank_transfer_proofs.sql` | `20261124144636` | `protect_pending_bank_transfer_proofs` |
| `20261124172000_block_new_xendit_route_claims.sql` | `20261124144640` | `block_new_xendit_route_claims` |
| `20261125003106_revoke_public_execute_from_admin_check_rpcs.sql` | `20261125003106` | `revoke_public_execute_from_admin_check_rpcs` |
| `20261125014500_restore_anon_execute_admin_check_rpcs.sql` | `20261125005419` | `restore_anon_execute_admin_check_rpcs` |
| `20261126120000_professional_services_taxonomy.sql` | `20261126123841` | `20261126120000_professional_services_taxonomy` |
| `20261126133000_professional_talent_services.sql` | `20261126123843` | `20261126133000_professional_talent_services` |
| `20261126143000_professional_service_applications.sql` | `20261126123845` | `20261126143000_professional_service_applications` |
| `20261126153000_admin_review_professional_service_application.sql` | `20261126123847` | `20261126153000_admin_review_professional_service_application` |
| `20261126160000_harden_professional_service_application_security.sql` | `20261126124312` | `20261126160000_harden_professional_service_application_security` |
| `20261126162000_enforce_professional_service_delivery_modes.sql` | `20261126123849` | `20261126162000_enforce_professional_service_delivery_modes` |
| `20261126173000_suspend_listing_when_application_needs_action.sql` | `20261126123851` | `20261126173000_suspend_listing_when_application_needs_action` |
| `20261126175000_allow_super_admin_professional_service_review.sql` | `20261126124314` | `20261126175000_allow_super_admin_professional_service_review` |
| `20261126182000_professional_service_application_notifications.sql` | `20261126123855` | `20261126182000_professional_service_application_notifications` |
| `20261126183000_professional_service_application_status_history.sql` | `20261126123857` | `20261126183000_professional_service_application_status_history` |
| `20261126190000_grant_professional_service_data_api_roles.sql` | `20261126123932` | `grant_professional_service_data_api_roles` |
| `20261126235800_allow_super_admin_professional_document_review.sql` | `20261126124323` | `20261126235800_allow_super_admin_professional_document_review` |
| `20261127000000_fix_professional_listing_public_account_gate.sql` | `20261126124016` | `fix_professional_listing_public_account_gate` |
| `20261127000200_restrict_professional_document_uploads.sql` | `20261126124325` | `20261127000200_restrict_professional_document_uploads` |
| `20261127001000_harden_professional_application_revision_attestation_fields.sql` | `20261126124423` | `harden_professional_application_revision_attestation_fields` |
| `20_immediate_escrow_release_policy.sql` | `20261117181958` | `yuku_20_immediate_escrow_release_policy` |
| `21_booking_completion_and_actor_guards.sql` | `20261117182035` | `yuku_21_booking_completion_and_actor_guards` |
| `22_talent_cancellation_and_refund_workflow.sql` | `20261117182053` | `yuku_22_talent_cancellation_and_refund_workflow` |
| `23_customer_cancellation_refund_foundation.sql` | `20261117182118` | `yuku_23_customer_cancellation_refund_foundation` |
| `24_hold_talent_earnings_during_customer_admin_review.sql` | `20261117182652` | `yuku_24_hold_talent_earnings_during_customer_admin_review` |
| `25_prelaunch_hardening_after_financial_hold.sql` | `20261117182717` | `yuku_25_prelaunch_hardening_after_financial_hold` |
| `26_admin_resolution_customer_cancellation_holds.sql` | `20261117182749` | `yuku_26_admin_resolution_customer_cancellation_holds` |
| `27_add_manual_qris_provider.sql` | `20261117182802` | `yuku_27_add_manual_qris_provider` |
| `31_become_talent_rpc.sql` | `20261117182812` | `yuku_31_become_talent_rpc` |
| `34_allow_customer_cancel_paid_booking.sql` | `20261117220737` | `yuku_34_allow_customer_cancel_paid_booking` |
| `40_talent_management_hybrid.sql` | `20261117221425` | `40_talent_management_hybrid` |
| `41_talent_management_security_hardening.sql` | `20261117221517` | `41_talent_management_security_hardening` |
| `42_admin_notifications_and_realtime.sql` | `20261120165015` | `42_admin_notifications_and_realtime` |
| `44_admin_new_booking_push.sql` | `20261120200910` | `admin_new_booking_push` |
| `45_affiliate_commission_settings.sql` | `20261120212637` | `45_affiliate_commission_settings` |
| `46_affiliate_earnings_payout_integration.sql` | `20261120215322` | `yuku_46_affiliate_earnings_payout_integration` |
| `47_affiliate_ledger_indexes.sql` | `20261120215324` | `yuku_47_affiliate_ledger_indexes` |
| `48_admin_access_foundation.sql` | `20261121081430` | `48_admin_access_foundation` |
| `49_scoped_admin_rls_policies.sql` | `20261121081509` | `49_scoped_admin_rls_policies` |
| `50_scoped_booking_and_review_rls.sql` | `20261121081521` | `50_scoped_booking_and_review_rls` |
| `51_admin_rpc_permission_guards.sql` | `20261121081523` | `51_admin_rpc_permission_guards` |
| `52_role_scoped_ktp_review_rpc.sql` | `20261121081524` | `52_role_scoped_ktp_review_rpc` |
| `53_scoped_ktp_and_storage_policies.sql` | `20261121081526` | `53_scoped_ktp_and_storage_policies` |
| `54_minimal_admin_read_rpcs_and_core_rls.sql` | `20261121081528` | `54_minimal_admin_read_rpcs_and_core_rls` |
| `55_admin_module_label_rpcs.sql` | `20261121081531` | `55_admin_module_label_rpcs` |
| `56_include_user_role_in_admin_summary.sql` | `20261121081532` | `56_include_user_role_in_admin_summary` |
| `57_finance_booking_code_labels.sql` | `20261121081535` | `57_finance_booking_code_labels` |
| `58_finance_booking_status_rpc.sql` | `20261121081536` | `58_finance_booking_status_rpc` |
| `59_super_admin_account_management_rpcs.sql` | `20261121081538` | `59_super_admin_account_management_rpcs` |
| `60_fix_admin_account_list_return_type.sql` | `20261121081545` | `60_fix_admin_account_list_return_type` |
| `61_restrict_is_admin_rpc_to_signed_in.sql` | `20261121081547` | `61_restrict_is_admin_rpc_to_signed_in` |
| `62_index_admin_audit_actor_foreign_keys.sql` | `20261121081552` | `62_index_admin_audit_actor_foreign_keys` |
| `62_scoped_admin_trigger_guard_hardening.sql` | `20261121081549` | `62_scoped_admin_trigger_guard_hardening` |
| `63_trusted_ktp_trigger_maintenance.sql` | `20261121081551` | `63_trusted_ktp_trigger_maintenance` |
| `64_align_production_talent_availability_policy.sql` | `20261121081503` | `64_align_production_talent_availability_policy` |
| `65_talent_media_moderation_and_private_storage.sql` | `20261124215042` | `talent_media_moderation_and_private_storage` |
| `66_gps_talent_service_location_and_nearest_search.sql` | `20261124220445` | `gps_talent_service_location_and_nearest_search` |
| `67_get_my_talent_service_location.sql` | `20261124220633` | `67_get_my_talent_service_location` |
| `68_restrict_nearest_talent_search_to_active_customers.sql` | `20261124221135` | `68_restrict_nearest_talent_search_to_active_customers` |

## Ambiguous local filenames (3)

- `20261126180000_require_professional_verification_attestation.sql` → `20261126123853 — 20261126180000_require_professional_verification_attestation`; `20261126124316 — 20261126180000_require_professional_verification_attestation`
- `20261126184000_guard_professional_service_provider_eligibility.sql` → `20261126123859 — 20261126184000_guard_professional_service_provider_eligibility`; `20261126124319 — 20261126184000_guard_professional_service_provider_eligibility`
- `20261126235700_require_active_account_for_professional_listings.sql` → `20261126123903 — 20261126235700_require_active_account_for_professional_listings`; `20261126124320 — 20261126235700_require_active_account_for_professional_listings`

These must be resolved using original SQL provenance, Git history, and resulting Production object definitions. Do not select one version based only on name or order.

## Local SQL files with no normalized-name candidate (52)

- `20261121120000_atomic_scoped_admin_invitation.sql`
- `20261126161000_allow_professional_service_revision_resubmission.sql`
- `20261126170000_professional_service_public_visibility_guard.sql`
- `20261126174000_lock_professional_application_revision_fields.sql`
- `20261126181000_protect_verification_attestation_fields.sql`
- `20261126185000_refine_professional_service_verification_levels.sql`
- `20261126190000_harden_payout_request_insert_access.sql`
- `20261126200000_restrict_booking_chat_by_status.sql`
- `20261126210000_revoke_trigger_helper_execute.sql`
- `20261126220000_index_bank_transfer_and_order_foreign_keys.sql`
- `20261126230000_harden_qris_proof_upload_and_trigger_acl.sql`
- `20261126235000_enforce_professional_service_rate_bounds.sql`
- `20261126235500_prevent_forged_professional_verification_attestation.sql`
- `20261126235900_allow_super_admin_talent_profile_review.sql`
- `20261127000100_professional_service_public_visibility_helper.sql`
- `20261127000300_limit_public_talent_profile_columns.sql`
- `20261127000400_create_private_professional_service_document_bucket.sql`
- `20261127000500_narrow_scoped_admin_booking_trigger_bypass.sql`
- `20261127000600_scope_admin_summary_rpcs.sql`
- `20261127000700_professional_provider_identity_decoupling.sql`
- `20261127000700_remove_legacy_public_talent_services_policy.sql`
- `20261127000800_restore_scoped_public_talent_availability_read.sql`
- `20261127000900_allow_self_service_customer_to_talent_transition.sql`
- `20261127001000_link_talent_selfie_evidence_and_guard_approval.sql`
- `20261127001000_stop_leaking_internal_report_notes.sql`
- `20261127001100_scope_admin_notifications_and_private_booking_chat.sql`
- `20261127001200_revoke_talent_media_trigger_helper_execute.sql`
- `20261127001300_make_talent_media_objects_immutable.sql`
- `20261127002000_finalize_social_experience_taxonomy.sql`
- `20261127002000_merchant_partner_membership_foundation.sql`
- `20261127003000_merchant_admin_review_and_directory.sql`
- `20261127003000_talent_custom_social_experience_services.sql`
- `20261127004000_create_independent_professional_provider_profiles.sql`
- `20261127004000_merchant_membership_management.sql`
- `20261127005000_allow_professional_only_applications.sql`
- `20261127005000_merchant_offers_directory.sql`
- `20261127006000_decouple_professional_review_and_publication.sql`
- `20261127007000_derive_professional_profile_completeness.sql`
- `20261127008000_prevent_professional_public_rls_recursion.sql`
- `20261127009000_allow_independent_professional_document_uploads.sql`
- `20261127010000_allow_super_admin_professional_profile_review.sql`
- `28_manual_qris_payment_workflow.sql`
- `29_qris_ledger_failed_payment_recovery.sql`
- `30_payment_route_lock_xendit_qris.sql`
- `32_fix_admin_review_talent_sets_is_approved.sql`
- `33_schedule_escrow_release_cron.sql`
- `35_missing_notifications.sql`
- `36_close_stale_qris_submissions.sql`
- `37_optimize_rls_auth_initplan.sql`
- `38_hero_slides.sql`
- `39_hero_bucket_limits_and_audit_log_read.sql`
- `43_booking_chat_push_notifications.sql`

This list mixes potentially new branch-only feature work, renamed historical migrations, superseded SQL, and files whose changes may have been applied manually or folded into later migrations. Absence from Production history is not permission to apply them.

## Production history records with no normalized-name candidate (35)

| Production version | Recorded name |
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
| `20261121152302` | `atomic_scoped_admin_invitation_20261121` |
| `20261126124333` | `restore_private_active_provider_gate_after_policy_hardening` |

These records need source recovery from original commits, deployment artifacts, or verified backups. A record missing from the current feature branch does not prove its SQL is absent from the live schema.

## High-risk review groups

1. Professional Provider identity decoupling and related application/review/upload policies.
2. Merchant Partner membership, locations, offers, review workflow, and tenant isolation.
3. Social Experience taxonomy and exact service-to-booking identity.
4. Payment, QRIS, bank transfer, escrow, payout, webhook, and trigger ACL changes.
5. Public Talent visibility, document storage, KTP evidence, and admin security hardening.

Several local migrations share version prefixes; see the collision audit and canonical manifest for the eight duplicate-prefix groups. Do not bulk-rename timestamps or replay the folder as-is.

## Required next steps

1. Recover missing Production SQL sources from the original Git commits or verified deployment records.
2. Compare candidate files to source SQL and Production function/trigger/policy/grant/index/constraint definitions.
3. Resolve all ambiguous records.
4. Classify every local-only file as new/unapplied, historical mismatch, superseded, duplicate, or unknown.
5. Obtain a healthy isolated Staging target and run replay plus JWT/RLS/functional regression tests there.
6. Keep Production read-only until the owner separately approves a reviewed migration plan.

## Safety status

- Production history and project metadata were read only.
- No SQL DDL/DML was run.
- No migration history repair, push, reset, or deployment was performed.
- No migration in this report is approved for execution.

Related: [PR #265 historical filename alignment](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/265), [PR #287 feature branch](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/287), [collision and canonical manifest](https://github.com/yukusocialindonesia-cpu/YUKU-id/blob/design/beranda-brand-promise-v2/docs/YUKU-CANONICAL-MIGRATION-MANIFEST-COLLISIONS-2026-11-27.md).


## Historical source trail verified in GitHub

The following merged PRs establish provenance for some Production migrations and are **not part of the 35 unmatched Production records** because their normalized names are already represented by files in the current feature branch:

| PR | Verified change | Evidence |
|---|---|---|
| [#39](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/39) | Three Community migrations: MVP, private moderation helper, FK indexes | Merged to `main`; changed-file list contains the three timestamped SQL files |
| [#40](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/40) | Active `activity_categories` public read policy | Merged to `main`; migration `20261121110017_fix_activity_categories_anon_read.sql` |
| [#41](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/41) | Public RLS helper EXECUTE permissions | Merged to `main`; migration `20261121110823_allow_public_rls_permission_checks.sql` |
| [#246](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/246) | Account-guard migration filename aligned to Production version `20261124081950` | Merged to `main`; PR body says SQL contents unchanged |
| [#247](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/247) | Public read policy for eligible Talent schedules | Merged to `main`; changed-file list contains `20261124150000_public_talent_availability_read.sql` |
| [#263](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/263) | Professional Services taxonomy and application lifecycle | Merged to `main`; PR changed-file list includes the foundational Professional Services SQL migrations |
| [#272](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/272) | Professional Services Data API grants | Merged to `main`; migration `20261126190000_grant_professional_service_data_api_roles.sql` |
| [#273](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/273) | Public Professional listing account gate | Merged to `main`; migration `20261127000000_fix_professional_listing_public_account_gate.sql` |
| [#274](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/274) | Professional application revision attestation hardening | Merged to `main`; migration `20261127001000_harden_professional_application_revision_attestation_fields.sql` |

PR #265 remains open and is a separate historical filename-alignment change. It renames 22 older local files without changing SQL. It is not a record that the 35 unmatched Production SQL sources have been recovered.

## What the 35 unmatched Production records mean

- **34 records dated 17–21 November** have no normalized-name candidate in the current feature branch. The repository PR evidence above recovers provenance for several adjacent features, but does not provide the missing SQL source for these 34 records.
- **1 record** — `20261126124333 restore_private_active_provider_gate_after_policy_hardening` — has no matching local file. It appears in the Professional Services eligibility hardening sequence; the current branch contains later public/provider guard migrations, but equivalence or supersession is not established by names alone.
- These 35 records should be labelled **historical SQL source not located**, not automatically “manual SQL” or “missing from live schema.” Migration history proves that a version/name was recorded; it does not expose the SQL body or prove the current object state.

## Next recovery route

1. Search the original deployment runner logs, archived SQL bundles, developer workstation history, and Supabase migration artifacts for the exact 35 version/name pairs.
2. For each recovered source, preserve its original bytes and compute a checksum before comparing it with current Production definitions.
3. Where no source is recoverable, document the affected database objects and reconstruct only through a separately reviewed, forward-only migration. Do not pretend a reconstruction is the original migration.
4. Resolve the 3 duplicate Production names independently; they remain ambiguous even if other historical sources are found.


## Production catalog spot-check (read-only, 27 Nov 2026)

A read-only PostgreSQL catalog inspection was performed against Production after the filename reconciliation. This is evidence that selected database objects currently exist; it is **not** proof that any unmatched historical migration file is byte-equivalent to a current local file, nor that the original migration ran under the same filename.

### Objects observed

| Historical topic / migration family | Production evidence observed | Assessment |
|---|---|---|
| Booking status history | `public.booking_status_history`, SELECT policy `status_history_select_parties_or_admin`, trigger `trg_log_booking_status_change` on `public.bookings`, function `log_booking_status_change` | Feature objects exist |
| Hero slides | `public.hero_slides`, public SELECT policy, admin write policies, updated-at trigger | Feature objects exist |
| Site branding | `public.site_branding`, public read policy, admin insert/update policies | Feature objects exist |
| Notifications / realtime / push | `public.notifications`, user SELECT/UPDATE policies, push-after-insert trigger and `notify_yuku_push_on_notification_insert` function | Core notification objects exist; realtime publication/webhook configuration needs separate verification |
| Payout guardrails | `public.payout_requests`, `request_talent_payout(...)`, `trg_guard_payout_completion_during_dispute`, validation and notification triggers | Multiple payout objects exist |
| Refund workflow | `public.refunds`, customer/admin SELECT policy, refund notification triggers and `admin_process_refund(...)` | Multiple refund objects exist |
| Public Talent visibility | `is_talent_publicly_visible(uuid)` and its use is referenced by the related Production migration history | Function exists; definition and grants need separate review |
| Activity category access | `public.activity_categories` with separate anon and authenticated SELECT policies | Access split exists |

### Important unresolved Production finding

The Production catalog still contains policy `payout_requests_insert_talent` on `public.payout_requests` (command `INSERT`, role `public`). Therefore, although the secure `request_talent_payout(...)` RPC exists, the catalog snapshot does **not** show the RPC-only INSERT lockdown described by the separate PR #44 proposal. Do not treat the secure RPC's presence as proof that direct table INSERT has been revoked.

### Limits and next checks

- This catalog query checked object names, trigger attachment, and policy names/commands/roles only. It did not compare complete function bodies, policy predicates, ACLs, storage policies, bucket settings, publication membership, extension schemas, or data.
- Object presence is not migration provenance. A table or function may have been created by a differently named migration or changed later.
- Continue with exact definition and ACL checks for the 35 unmatched Production records, and locate original SQL through historical PR patches/commit trees before proposing any migration-history repair.
- No Production SQL migration, DDL, DML, or deployment was run during this inspection.


### Definition-level follow-up (read-only)

The second catalog query retrieved selected live definitions and confirms:

- `public.is_talent_publicly_visible(uuid)` checks Talent role, active account, 18+ verification, verified KTP, approved Talent profile, and at least one active approved Talent service.
- `public.request_talent_payout(...)` checks authenticated actor, active Talent account, age/KTP/profile approval, minimum payout amount, bank-field shape, and idempotency consistency before inserting.
- `public.guard_payout_completion_during_dispute()` blocks completion when reserved allocations point to earnings in `disputed_hold`.
- `public.log_booking_status_change()` writes status changes to `booking_status_history`, classifying system/admin/user actors.
- `public.notifications` is present in the `supabase_realtime` publication for INSERT/UPDATE/DELETE.
- The direct INSERT policy on `payout_requests` is still present and its check is only `auth.uid() = talent_id`; it does not encode the RPC's full eligibility checks. This is a concrete hardening gap to review, not an instruction to change Production.

These results strengthen the classification that several unmatched historical topics are represented in the current Production schema, while also surfacing a direct-payout-insert policy that remains broader than the RPC's business validation. No changes were made to Production.


## ACL, Storage, and SECURITY DEFINER audit (read-only, 27 Nov 2026)

### RLS coverage

The catalog snapshot showed Row Level Security enabled on every inspected table in `public`, `private`, and `storage`. The two private admin tables (`private.admin_accounts`, `private.admin_permissions`) also have FORCE ROW LEVEL SECURITY enabled. The inspected public tables do not have FORCE RLS enabled; table-owner/service-role bypass behavior therefore remains relevant and must not be confused with ordinary authenticated-client access.

### Storage buckets and policies

Observed bucket configuration:

| Bucket | Public | Max size | Main finding |
|---|---:|---:|---|
| `avatars` | yes | 10 MiB | Owner writes; public reads |
| `portfolios` | yes | 5 MiB | Owner writes; public reads |
| `talent-media` | no | 50 MiB | Read policy delegates to `can_read_talent_media_object(name)`; owner writes |
| `ktp-documents` | no | 5 MiB | Owner upload; owner or authorized admin read |
| `professional-service-documents` | no | 10 MiB | Owner/admin read; see blocker below |
| `bank-transfer-payment-proofs` | no | 5 MiB | Customer/finance read; upload tied to own pending manual-transfer booking |
| `qris-payment-proofs` | no | 5 MiB | Customer/finance read; upload tied to own pending-payment booking |
| `branding`, `hero`, `hero-slides`, `promotions`, `qris-payment-display` | yes | 5 MiB each | Public display assets; admin/finance writes |

All listed buckets restrict MIME types to image formats and/or PDF, except `talent-media`, which also permits video and audio formats.

### Confirmed Professional Provider dependency blocker

The Production policy `professional_service_documents_owner_upload` on Storage requires both:
- the uploader's account to be active; and
- a matching row in `public.talent_profiles`.

The INSERT policy on `professional_service_applications` also requires a matching `talent_profiles` row. Therefore Production still does **not** support a fully independent Professional Provider application/upload path for an account without a Talent profile. This confirms the previously identified launch blocker from live policy definitions.

### SECURITY DEFINER review

The inspected SECURITY DEFINER functions generally pin `search_path` to an empty path, with schema-qualified object references. Two trigger functions are exceptions:
- `public.sync_talent_rating_stats()`
- `public.validate_review_insert()`

Both set `search_path=public`. Their current ACL snapshot lists EXECUTE only for `postgres`, so they are not directly callable by ordinary API roles based on the inspected grants, and they are trigger-oriented. Still, pinning their search path to an empty path and qualifying references would be a worthwhile hardening cleanup.

The inspected user-facing SECURITY DEFINER RPCs with authenticated EXECUTE grants include payout request, payment-proof submission, booking cancellation, Talent onboarding/profile/service operations, and admin review functions. Their function bodies and authorization branches need targeted manual review; a blanket count of SECURITY DEFINER functions is not a vulnerability finding.

### Findings and priority

1. **High — payout direct INSERT policy:** `payout_requests_insert_talent` still permits direct INSERT when `auth.uid() = talent_id`, which bypasses the stronger business checks in `request_talent_payout(...)`. Review before production launch.
2. **High — independent Professional Provider not enabled in Production:** application INSERT and document upload still depend on `talent_profiles`. The decoupling migrations in the feature branch are not reflected in these live policies.
3. **Medium — public-facing object policies:** avatar/portfolio buckets are public and `talent-media` is non-public but uses a custom object-read function. Validate the full function logic and public URL/signed URL usage against product privacy expectations.
4. **Low/cleanup — SECURITY DEFINER search path:** two trigger functions still use `search_path=public`; pin to empty path and qualify references in a future reviewed migration.
5. **Coverage note:** RLS is enabled on inspected tables, but most public tables are not FORCE RLS. Review table ownership, grants, and service-role exposure separately.

This is a catalog/configuration audit, not an application penetration test. It did not test requests under anon/authenticated JWTs, inspect actual object contents, or mutate policies, buckets, grants, or functions. No Production SQL changes were made.


## Sensitive RPC definition and EXECUTE-ACL audit (read-only, 27 Nov 2026)

The following live Production function definitions and grants were inspected directly from `pg_proc` and `pg_get_functiondef`. This was a static review only; no RPC was invoked and no transaction or row was changed.

### Authorization and grant observations

- The inspected business/admin SECURITY DEFINER RPCs pin `search_path` to an empty path and use schema-qualified object references.
- `admin_process_payout`, `admin_process_refund`, `admin_resolve_customer_cancellation_case`, `admin_resolve_report`, and the inspected admin review RPCs check scoped permissions through `public.has_admin_permission(...)` before sensitive actions.
- `set_admin_active` and `set_admin_permissions` require an authenticated Super Admin; they prevent the acting Super Admin from modifying their own account/permissions.
- `provision_scoped_admin_account(...)` and `provision_scoped_admin_account_with_permissions(...)` require the JWT role to be `service_role` and validate the supplied creator as an active Super Admin. Their EXECUTE ACL is service-role only (plus owner).
- `settle_booking_payment(...)` is service-role/server-only by an explicit JWT-role/session-user check; its ACL is limited to service_role (plus owner).
- Two permission-check helper RPCs, `public.has_admin_permission(text)` and `public.is_super_admin()`, currently grant EXECUTE to `anon` as well as `authenticated`. Their bodies only evaluate the current `auth.uid()` through private helpers, so an anonymous caller should receive a false result; this is not by itself an authorization bypass. Nevertheless, anon EXECUTE is unnecessary and should be removed in a reviewed hardening migration, while retaining the grants required by public RLS policy evaluation if that is the intended design.
- The legacy `admin_review_qris_payment(...)` function has owner-only EXECUTE in the inspected ACL, while `admin_review_qris_payment_finance(...)` grants authenticated EXECUTE and performs the finance permission check. The owner-only legacy function is not client-callable through the normal API role; avoid granting it broadly without checking which frontend path is intended.

### Sensitive workflow review

| Area | Live function behavior observed | Assessment |
|---|---|---|
| Payout request | `request_talent_payout` validates actor, active Talent, 18+ and KTP/profile approval, minimum Rp100,000, bank-field shape, and idempotency-key payload consistency | Strong RPC validation, but the separate direct INSERT policy remains a high-priority bypass of these checks |
| Payout processing | `admin_process_payout` requires finance permission, locks the payout row, validates allowed status transitions, requires a rejection reason/provider reference, and writes an admin audit log | No obvious authorization gap in the inspected body; direct table-write paths still need separate grant/trigger review |
| Refund processing | `admin_process_refund` requires finance permission, locks refund/payment/booking rows, caps aggregate refunds at payment amount, checks cancellation-policy limits, enforces unique provider reference, and performs full-refund ledger/booking updates | Guardrails are present in the inspected RPC; no runtime concurrency or end-to-end refund test was performed |
| Cancellation-case resolution | `admin_resolve_customer_cancellation_case` requires finance permission, pending case state, positive held amount, completed automatic refund, and guards against reversing already allocated/paid Talent earnings | Strong static checks observed; requires staging workflow tests for each decision branch |
| Customer cancellation | `request_customer_cancellation` verifies caller owns booking, allowed booking state, future session, one case per booking, and computes the cancellation policy/refund split | Ownership and state checks observed |
| Talent cancellation | `request_talent_cancellation` verifies caller is the booking Talent, allowed state, and payment remains held before requesting a full refund | Ownership/state checks observed |
| Booking creation | `create_booking` requires authenticated eligible Customer, active/approved/publicly visible Talent, approved active service/category, matching online/offline mode, rate, schedule, and enabled checkout | Strong eligibility checks observed; concurrency/availability race tests remain outstanding |
| Admin moderation | `admin_resolve_report` checks support permission and audits the decision; payout/refund/admin-review RPCs checked use finance or other scoped permissions | No obvious missing permission gate in inspected paths; must verify all sibling RPCs and role/JWT matrix |

### Confirmed P1 settlement idempotency issue

The live `settle_booking_payment(...)` function returns `TRUE` when a booking is already in a paid/confirmed/in-progress/completed state, without comparing the retry's provider, provider charge ID, payment method, or amount to the existing `payments` row. A duplicate or mismatched webhook retry can therefore be acknowledged as successful without proving that it matches the original settlement. This is consistent with the previously recorded P1 risk and should be fixed before enabling the payment webhook/provider path. The function is currently server/service-role only; the finding is about retry correctness, not public client access.

The same function updates an expired booking and then raises an exception. In PostgreSQL, the exception rolls back the transaction, so that inline expiry status update does not persist. The separate expiry job/cron must remain the durable expiry mechanism; the RPC should return/raise without implying that its attempted status update was committed.

### Priority updates

1. **P1 — settlement retry does not verify original payment identity:** compare provider, charge ID, amount, and relevant payment fields against the existing payment before returning idempotent success; reject mismatches and test duplicate webhook delivery in Staging.
2. **P1 — direct payout INSERT remains broader than payout RPC validation:** revoke direct client INSERT and route requests through the validated RPC, after confirming app compatibility and a tested rollback plan.
3. **P2 — anonymous EXECUTE on admin permission helper wrappers:** remove unnecessary anon grants only after checking dependencies from RLS policies and public read flows.
4. **P2 — full JWT/RPC matrix not run:** test anon, ordinary authenticated Customer, Talent, Professional Provider, scoped admin (each permission), Super Admin, and service_role in isolated Staging.
5. **P2 — refund/cancellation and booking concurrency tests outstanding:** exercise duplicate requests, parallel refund attempts, already-allocated earnings, booking slot races, and provider retry/mismatch cases.

### Safety and confidence

This is a definition/ACL review of selected functions, not a penetration test or complete inventory of every RPC. The findings are based on current catalog definitions and grants. No function was called, no DDL/DML was executed, no migration was applied, and Production remains unchanged. No item in this report is approved for direct Production modification.


## Supabase migration executor failure confirmation — 27 Nov 2026
- Read-only unified-log inspection of the Supabase project confirms repeated executor failures on 26 Nov 2026: `ERROR Remote migration versions not found in local migrations directory.`
- The matching workflow logs identify the affected branch as the project's default `main` branch (branch UUID `4f3cf733-ee3a-4d11-8960-1efe0a806e3c`). This aligns with the current branch status `MIGRATIONS_FAILED`.
- Live Production history contains 129 migration records; the feature branch currently contains 143 SQL migration files. Corrected descriptive-name normalization still leaves 35 Production records without a local filename candidate; 34 are historical records dated 17–21 Nov 2026. Several older names are not represented as timestamp-prefixed files in the repository, so version-only matching overstates the mismatch count; filename normalization is the more useful comparison but does not establish SQL equivalence.
- Do not fabricate placeholder files or mark remote versions applied merely to clear the executor error. Recover the exact historical SQL from original commits, deployment artifacts, or verified backups, then compare resulting database objects and establish a canonical replay manifest. Do not replay historical migrations against Production as a repair exercise.
- The exact failed executor message is now confirmed. The full source-level cause is a historical migration-source/version reconciliation gap; individual SQL bodies for the 35 unmatched records have not yet been recovered.
- All evidence gathered in this pass was read-only. No migration, database mutation, branch creation, or deployment was performed.


## Historical SQL source recovery checkpoint — 27 Nov 2026 (Git history)
Read-only inspection of original Git commits and migration diffs recovered additional provenance for several historical groups. This is source recovery evidence, not proof that every recovered body is byte-identical to the SQL applied on Production.

### Source commits and migration groups
- **Community:** commit [519c2708](https://github.com/yukusocialindonesia-cpu/YUKU-id/commit/519c2708a2ab54874a06d5a1a036149e33765f84) contains the original Community MVP and related schema work. Follow-up commit [3b39e822](https://github.com/yukusocialindonesia-cpu/YUKU-id/commit/3b39e8221ce260cb1b6a4b6c29e8d0cc1c80817b) explicitly aligns the three applied filenames to Production versions 20261121105125, 20261121105216, and 20261121105232. The exact renamed files are present in that commit's file list.
- **Affiliate:** commit [a8e769f8](https://github.com/yukusocialindonesia-cpu/YUKU-id/commit/a8e769f868f5e5d1ec0c1ce0c78dac839f5c0aae) contains SQL source for the Affiliate earnings/payout integration and ledger indexes (46_affiliate_earnings_payout_integration.sql, 47_affiliate_ledger_indexes.sql), alongside the application/type changes. This provides the historical SQL source for those two migration bodies; verify their normalized/timestamped current copies before declaring the remote records reconciled.
- **Scoped Admin:** commit [6dd4987f](https://github.com/yukusocialindonesia-cpu/YUKU-id/commit/6dd4987f8eeff38db4e6d2253534f8471c86345a) contains original SQL migration files 48_admin_access_foundation.sql through the scoped permission/RLS/RPC migration group, plus associated Admin test scripts. This is a source-of-truth location for recovering those SQL bodies and checking the timestamped rename set in PR #265.
- **Web Push:** commit [7d06acc4](https://github.com/yukusocialindonesia-cpu/YUKU-id/commit/7d06acc4181f70574e492d11facdec3406e9bb1d) contains SQL for 20261121020000_create_push_subscriptions.sql and 20261121021500_add_yuku_push_notification_webhook.sql. These filenames/timestamps do **not** directly match the Production history item 20261120185544 (enable_pg_net_for_push_webhook). Do not equate the two. The exact SQL for the Production enable_pg_net_for_push_webhook record is still unverified and must be recovered separately.

### What this changes
- The previous statement that none of the historical SQL bodies had been recovered is no longer accurate for the groups above.
- The original Git source for Community, Affiliate, scoped Admin, and Web Push subscription/webhook work is now located.
- The unresolved Production migration list still requires a record-by-record comparison. A source commit, similar purpose, or matching object name is not sufficient to prove equivalence to the SQL that ran remotely.
- No migration repair, SQL execution, DDL/DML, Production change, branch creation, merge, or deployment was performed during this recovery pass.


## Follow-up historical security migration provenance — 27 Nov 2026
Read-only inspection of related PRs and original SQL files clarifies several nearby records and prevents false matches:

- **Confirmed exact Production record:** PR [#41](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/41) contains `20261121110823_allow_public_rls_permission_checks.sql`, whose two GRANT statements allow `anon` to execute `public.is_super_admin()` and `public.has_admin_permission(text)`. PR #41 records that this migration was applied directly to Production and verified. This is a known applied migration and is not one of the 55 unmatched records in the reconciliation snapshot.
- **Not the same as missing `grant_anon_execute_is_admin` / `grant_anon_execute_is_talent_publicly_visible`:** the PR #41 migration grants only the two named admin-check wrappers. Do not use it as a substitute for either missing 18 Nov grant migration.
- **Separate unapplied payout hardening:** PR [#44](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/44) contains `20261121120000_secure_talent_payout_insert_rpc_only.sql`, which drops the direct Talent INSERT policy and revokes table/column INSERT grants on `payout_requests`. Its timestamp is not the missing Production record `20261117232240_add_secure_talent_payout_request_rpc_20261118`; it is a later, separate hardening change and PR #44 was closed without merge. Do not map these as equivalent.
- **Separate draft booking hardening:** PR [#45](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/45) contains `63_h2_talent_booking_status_rpc_hardening.sql`, moving Talent booking confirmation/session start into guarded RPCs and revoking direct booking workflow-column UPDATE. It remains an unmerged draft and is not evidence for the missing Production record `20261118163142_create_booking_enforce_category_mode_and_approved_services`.
- **Web Push distinction retained:** PR #12's push subscription and webhook migrations do not establish the SQL body for Production `20261120185544_enable_pg_net_for_push_webhook`.

### Current disposition
The records above are now classified as exact known match, distinct later change, or unrelated draft rather than being inferred from similar names. The remaining historical security and operational migrations still require original SQL recovery or verified deployment artifacts. No migration was executed, no database was modified, and Production remains read-only.


## Scoped Admin invitation migration source recovery — 27 Nov 2026

- Production history contains version `20261121152302` with recorded name `atomic_scoped_admin_invitation_20261121`.
- Merged PR [#46](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/46) contains `supabase/migrations/20261121120000_atomic_scoped_admin_invitation.sql` in commit `707658f32b5c286acf363cc4890ad1a57c208b09`.
- The original PR file and current feature-branch file were fetched and compared; their SQL content is byte-for-byte identical. It defines `provision_scoped_admin_account_with_permissions(uuid, uuid, text[])`, requires `service_role`, checks the inviter is an active Super Admin, validates permission keys, atomically updates the user/Admin records and permission rows, writes an audit log, and grants EXECUTE only to `service_role`.
- **Classification:** recovered high-confidence source candidate for the Production record by distinctive migration purpose and exact SQL file provenance. However, the file's local timestamp `20261121120000` differs from Production's recorded version `20261121152302`; Git evidence does not prove that this exact body was what the Production migration runner executed. Keep the Production record formally **not byte-verified** until deployment artifact/history checksum or equivalent evidence is found.
- This source recovery does not authorize replay or a migration-history repair. No database was changed.
