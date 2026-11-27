# Rekonsiliasi Migrasi Supabase YUKU — 28 November 2026

## Status

- Target: Supabase Production `sbqvltqzzcsqzijgumld` (`yukuproduction`, region `ap-southeast-1`).
- Status project: `ACTIVE_HEALTHY`, PostgreSQL 17.12.
- Migration ledger: **132** entri; versi terakhir **`20261127181622` — `preserve_legacy_verified_customer_identity`**.
- Folder `supabase/migrations/` pada `main`: **148** file SQL.
- Perbandingan nama deskriptif yang dinormalisasi: **96** record remote punya kandidat nama lokal; **36** record remote belum punya pasangan lokal yang meyakinkan; **53** file lokal belum punya pasangan remote.
- Karena dua nama lokal punya kandidat ganda, 96 pasangan remote hanya mencakup 95 file lokal unik. Pencocokan nama bukan checksum atau bukti isi SQL identik.

## Bukti skema Production (query baca-saja)

- Terdapat 54 tabel public, 132 fungsi public, dan 110 trigger public.
- Ada: `professional_service_applications`, `professional_service_categories`, `professional_talent_services`.
- Belum ada: `merchant_businesses`, `merchant_memberships`, `merchant_locations`, `professional_provider_profiles`, dan `talent_custom_social_experience_services`.
- RPC `create_merchant_business` belum ada.
- Constraint `bookings_payment_route_check` masih mengizinkan `xendit`. Fungsi `claim_booking_payment_route` masih mengenali jalur Xendit untuk booking lama, dan `settle_booking_payment` masih menerima provider Xendit.
- Jumlah booking dengan `payment_route = 'xendit'`: **0**. Jumlah baris pembayaran dengan provider Xendit: **0**.
- Hak UPDATE tabel `reports_complaints` untuk role `authenticated` sudah tidak ada, tetapi masih ditemukan satu policy UPDATE; file lokal `20261127191000_revoke_direct_report_moderation_updates.sql` perlu diperiksa sebagai perubahan yang belum tercatat/baru sebagian tercermin.

## Temuan yang harus ditangani

1. **SQL historis hilang dari repository.** Versi remote terakhir `20261127181622 preserve_legacy_verified_customer_identity` sendiri belum memiliki file SQL yang cocok pada `main`. Jangan membuat SQL pengganti berdasarkan tebakan; cari sumber commit, deployment artifact, atau backup yang dapat diverifikasi.
2. **File lokal yang belum terpetakan bukan otomatis pending.** Klasifikasikan setiap file sebagai migration baru, historical rename, sudah tercakup migration lain, superseded, duplikat, atau belum diketahui.
3. **Xendit belum sepenuhnya dipensiunkan pada database.** File `20261127190000_retire_xendit_booking_checkout.sql` belum tercatat pada ledger Production. File tersebut memuat guard yang akan menghentikan migrasi jika booking lama masih memakai route Xendit; pemeriksaan baca-saja saat ini menemukan 0 booking dan 0 payment Xendit. Tetap perlu review lengkap dan persetujuan sebelum eksekusi.
4. **Merchant/Provider bukan satu batch siap jalan.** Tabel Merchant dan `professional_provider_profiles` belum ada. Migrasi Merchant merujuk ke profil Provider, sehingga urutan dan dependensi wajib diselesaikan dahulu.
5. **Duplikasi nama lokal:** dua kandidat untuk `harden_professional_application_revision_attestation_fields` (`20261127001000` dan `20261127001500`) dan dua kandidat untuk `talent_custom_social_experience_services` (`20261127003000` dan `20261127005500`). Ada pula prefix legacy `62` yang dipakai dua file: `62_index_admin_audit_actor_foreign_keys.sql` dan `62_scoped_admin_trigger_guard_hardening.sql`.

## Record Production yang belum memiliki pasangan nama lokal

| Versi | Nama di ledger |
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
| 20261121152302 | atomic_scoped_admin_invitation_20261121 |
| 20261126124333 | restore_private_active_provider_gate_after_policy_hardening |
| 20261127181622 | preserve_legacy_verified_customer_identity |

## File lokal yang belum terpetakan ke ledger Production

```text
20261121120000_atomic_scoped_admin_invitation.sql
20261126161000_allow_professional_service_revision_resubmission.sql
20261126170000_professional_service_public_visibility_guard.sql
20261126174000_lock_professional_application_revision_fields.sql
20261126181000_protect_verification_attestation_fields.sql
20261126185000_refine_professional_service_verification_levels.sql
20261126190050_harden_payout_request_insert_access.sql
20261126200000_restrict_booking_chat_by_status.sql
20261126210000_revoke_trigger_helper_execute.sql
20261126220000_index_bank_transfer_and_order_foreign_keys.sql
20261126230000_harden_qris_proof_upload_and_trigger_acl.sql
20261126235000_enforce_professional_service_rate_bounds.sql
20261126235500_prevent_forged_professional_verification_attestation.sql
20261126235900_allow_super_admin_talent_profile_review.sql
20261127000100_professional_service_public_visibility_helper.sql
20261127000300_limit_public_talent_profile_columns.sql
20261127000400_create_private_professional_service_document_bucket.sql
20261127000500_narrow_scoped_admin_booking_trigger_bypass.sql
20261127000600_scope_admin_summary_rpcs.sql
20261127000700_remove_legacy_public_talent_services_policy.sql
20261127000800_restore_scoped_public_talent_availability_read.sql
20261127000900_allow_self_service_customer_to_talent_transition.sql
20261127001050_stop_leaking_internal_report_notes.sql
20261127001100_scope_admin_notifications_and_private_booking_chat.sql
20261127001200_revoke_talent_media_trigger_helper_execute.sql
20261127001300_make_talent_media_objects_immutable.sql
20261127001400_professional_provider_identity_decoupling.sql
20261127001600_link_talent_selfie_evidence_and_guard_approval.sql
20261127001900_finalize_social_experience_taxonomy.sql
20261127002000_merchant_partner_membership_foundation.sql
20261127003100_merchant_admin_review_and_directory.sql
20261127004100_merchant_membership_management.sql
20261127005100_merchant_offers_directory.sql
20261127006000_decouple_professional_review_and_publication.sql
20261127007000_derive_professional_profile_completeness.sql
20261127008000_prevent_professional_public_rls_recursion.sql
20261127009000_allow_independent_professional_document_uploads.sql
20261127010000_allow_super_admin_professional_profile_review.sql
20261127011000_social_experience_service_id_foundation.sql
20261127150000_preserve_sanctioned_account_status_on_talent_review.sql
20261127190000_retire_xendit_booking_checkout.sql
20261127191000_revoke_direct_report_moderation_updates.sql
28_manual_qris_payment_workflow.sql
29_qris_ledger_failed_payment_recovery.sql
30_payment_route_lock_xendit_qris.sql
32_fix_admin_review_talent_sets_is_approved.sql
33_schedule_escrow_release_cron.sql
35_missing_notifications.sql
36_close_stale_qris_submissions.sql
37_optimize_rls_auth_initplan.sql
38_hero_slides.sql
39_hero_bucket_limits_and_audit_log_read.sql
43_booking_chat_push_notifications.sql
```

## Rencana aman

1. Pulihkan 36 SQL historis yang hilang dari sumber tepercaya; mulai dari versi terakhir `20261127181622`.
2. Buat manifest satu-banding-satu berdasarkan provenance dan isi SQL, bukan nama saja.
3. Klasifikasikan 53 file lokal satu per satu dan tetapkan dependensi/urutan.
4. Periksa migration duplicate/ambiguous names dan prefix.
5. Siapkan environment staging disposable. Branch Supabase yang terlihat pada audit hanya `main`; metadata branch melaporkan `MIGRATIONS_FAILED` meski project utama `ACTIVE_HEALTHY`, sehingga status ini perlu ditelusuri sebelum mengandalkan Preview.
6. Replay seluruh chain di staging, lalu jalankan RLS/JWT, trigger, Storage, payment/escrow, booking, dan regression tests.
7. Baru susun paket perubahan Production untuk persetujuan terpisah.

## Batas tindakan

Audit ini hanya membaca GitHub dan metadata/skema Supabase. **Tidak ada SQL DDL/DML, migration push, migration repair, reset, atau perubahan Production yang dilakukan.** Jangan jalankan seluruh folder migration secara massal.

Supabase CLI v3 mengubah default database command menjadi local; perintah hosted perlu target `--remote`, dan perubahan hosted otomatis memerlukan konfirmasi (CI memakai `--yes`). Lihat [CLI v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3) dan [migration list reference](https://supabase.com/docs/reference/cli/supabase-migration-list).
