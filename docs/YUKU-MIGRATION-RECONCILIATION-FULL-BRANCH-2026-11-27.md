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
