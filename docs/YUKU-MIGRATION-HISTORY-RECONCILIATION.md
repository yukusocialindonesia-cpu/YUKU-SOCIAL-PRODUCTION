# YUKU — Migration History Reconciliation

Tanggal: 26 November 2026
Branch: `feat/professional-services-categories`
Supabase project yang diperiksa: `sbqvltqzzcsqzijgumld` (`yukuproduction`)
Metode: inspeksi GitHub source dan pembacaan migration history Supabase secara read-only.

## Kesimpulan

Jangan menjalankan `supabase db push`, replay seluruh folder, atau rename migration lama sebelum rekonsiliasi selesai.

Temuan awal tentang dua migration version `62` perlu diperjelas. Production history mencatat dua perubahan tersebut dengan version timestamp berbeda:

| Production version | Recorded migration name |
|---|---|
| `20261121081549` | `62_scoped_admin_trigger_guard_hardening` |
| `20261121081552` | `62_index_admin_audit_actor_foreign_keys` |

Jadi Production tidak memiliki duplicate version ID untuk dua perubahan ini. Namun branch menyimpan kedua file dengan prefix `62_`, dan folder juga memuat rangkaian legacy bernomor `01` sampai `68`, sedangkan Production history memakai timestamp seperti `2026111718...` dan `2026112108...`.

Ini adalah ketidakselarasan identitas/version migration antara file repository dan history Production. Jangan menganggap file bernomor pendek sebagai migration baru yang aman diterapkan.

## Bukti read-only

- Project `yukuproduction` berstatus `ACTIVE_HEALTHY`.
- PostgreSQL Production 17.12.0.
- Supabase migration history berhasil dibaca tanpa mengeksekusi SQL.
- Dua perubahan bernama `62` memiliki dua version Production yang unik.
- Repository branch memiliki 125 file SQL di `supabase/migrations/`.
- Pemeriksaan prefix menemukan dua file dengan prefix `62`.
- Tidak ada data pengguna yang dibaca dan tidak ada schema, migration history, atau konfigurasi Production yang diubah.

## Risiko jika langsung melakukan push

Jika migration runner menganggap prefix file sebagai version ID, file bernomor pendek dapat dianggap pending walaupun perubahan setara sudah pernah diterapkan di Production dengan version timestamp berbeda. Replay rangkaian lama dapat menjalankan ulang DDL, function, trigger, GRANT/REVOKE, atau policy dan menimpa hardening yang lebih baru.

Idempotent SQL tidak otomatis aman untuk replay. `CREATE OR REPLACE FUNCTION`, GRANT/REVOKE, policy, trigger, dan perubahan status dapat mengubah perilaku walaupun statement tidak gagal.

## Rencana rekonsiliasi wajib

1. Ambil seluruh Production migration history sebagai daftar version dan name.
2. Ambil seluruh migration filename di branch.
3. Buat pemetaan satu-ke-satu berdasarkan isi SQL, bukan hanya kemiripan nama.
4. Klasifikasikan tiap migration: applied exact version, equivalent under different version, branch-only/unapplied, superseded, atau unknown/conflict.
5. Periksa apakah SQL file branch sama dengan perubahan yang tercatat di Production.
6. Tentukan baseline canonical untuk Staging/CI; jangan memakai folder legacy mentah.
7. Jika nama/version perlu diperbaiki, pertahankan audit trail dan jangan mengubah migration yang sudah diterapkan.
8. Setelah pemetaan lengkap, jalankan replay terkontrol di Staging dan regression tests.

## Keputusan saat ini

- Tidak mengubah atau rename migration files.
- Tidak membuat migration SQL baru.
- Tidak menjalankan `db push`, `db reset`, `migration repair`, atau SQL DDL.
- Tidak membuat Supabase branch baru yang mungkin menimbulkan biaya.
- Tidak mengubah Production.
- Prefix ganda `62` dicatat sebagai gejala naming mismatch, bukan bukti duplicate version ID di Production.

## Referensi

- Supabase CLI v3 migration guide: https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- Supabase breaking changes: https://supabase.com/changelog?types=breaking-change
- `supabase/migrations/README.md`
- `docs/PRODUCTION_SAFETY.md`
## Rekonsiliasi nama — hasil pemetaan awal

Pembacaan Production menghasilkan 107 migration records. Folder branch berisi 140 file `.sql` jika dihitung seluruh artefak SQL di folder tersebut. Pencocokan nama yang dinormalisasi menemukan 73 file dengan pasangan nama Production yang jelas. Angka ini adalah pencocokan nama, bukan bukti byte-for-byte SQL identik.

Contoh file lama bernomor pendek yang memiliki pasangan Production timestamp:
- `01`–`07` memiliki version Production `01`–`07`.
- `08`–`19` memiliki pasangan timestamp Production `2026111718...`.
- `20`–`27`, `31`, `34`, `40`–`64`, serta beberapa file bertimestamp memiliki pasangan nama/version Production yang tercatat.
- Dua file prefix `62` cocok dengan dua version Production berbeda seperti tabel di atas.

Contoh mismatch timestamp yang harus dipetakan dengan isi SQL, bukan nama:
- Branch `20261121020000_create_push_subscriptions.sql` berpasangan nama dengan Production version `20261120185433`.
- Branch `20261121021500_add_yuku_push_notification_webhook.sql` berpasangan nama dengan Production version `20261120185621`.
- Branch `20261124081950_enforce_active_account_sessions.sql` tercatat di Production dengan version `20261124081950`, tetapi recorded name menyimpan timestamp lama `20261124120000_enforce_active_account_sessions`.
- Branch `20261124150000_public_talent_availability_read.sql` berpasangan nama dengan Production version `20261124084839`.
- Branch `20261124165900_add_manual_bank_transfer_provider.sql` berpasangan nama dengan Production version `20261124144625`.

File yang tidak cocok berdasarkan nama belum otomatis berarti belum diterapkan. Kelompok ini mencakup migration branch-only yang lebih baru, file test/arsip, migration dengan nama berbeda, dan kemungkinan perubahan yang sudah digabung ke migration lain. Setiap file harus ditinjau SQL dan dependency-nya sebelum diberi status.

## Status verifikasi yang belum dilakukan

- Belum dilakukan hash/diff SQL terhadap definisi historis yang diterapkan di Production.
- Belum dipastikan apakah semua file lama 28–39 dan 43 merupakan migration terpisah, telah digabung, atau hanya arsip.
- Belum dipastikan migration branch-only mana yang sudah diterapkan pada environment lain.
- Belum ada Staging aktif yang dikonfirmasi dan belum ada replay migration.
- Tidak ada DDL atau migration mutation yang dijalankan.
## Pemeriksaan objek aktual dan environment

Read-only catalog query Production mengonfirmasi objek berikut saat ini ada:
- Function `claim_booking_payment_route(uuid,text)` dan kolom `bookings.payment_route`.
- Function `auto_generate_booking_financial_ledgers()`.
- Function `close_qris_submissions_on_booking_inactive()`.
- Function `notify_on_booking_message_insert()`.
- Function `process_escrow_release()`.
- Function `admin_review_talent(uuid,boolean,ktp_status_type,text)`.
- Kolom `qris_payment_submissions.status` dan `hero_slides.mobile_image_url`.

Ini membuktikan fitur/objek tersebut ada pada schema Production saat pemeriksaan, tetapi **tidak membuktikan file bernama 28–43 yang ada di repository adalah sumber yang persis diterapkan**. Sebagian perubahan dapat berasal dari SQL Editor/manual migration atau migration bernama lain. Untuk membuktikan provenance perlu membandingkan function definition, constraints, policies, triggers, extension/job metadata, serta file SQL satu per satu.

Daftar Supabase development branches menunjukkan satu branch bernama `main`, dengan status `MIGRATIONS_FAILED` dan `preview_project_status` `ACTIVE_HEALTHY`. Daftar projects hanya menunjukkan project Production `yukuproduction`; tidak ditemukan project Staging terpisah. Status branch ini membuatnya tidak layak dipakai sebagai bukti migration replay sukses. Penyebab kegagalan belum ditentukan.

## Klasifikasi tambahan file yang perlu diperhatikan

- `28_manual_qris_payment_workflow.sql`, `29_qris_ledger_failed_payment_recovery.sql`, `30_payment_route_lock_xendit_qris.sql`, `32_fix_admin_review_talent_sets_is_approved.sql`, `33_schedule_escrow_release_cron.sql`, `35_missing_notifications.sql`, `36_close_stale_qris_submissions.sql`, `37_optimize_rls_auth_initplan.sql`, `38_hero_slides.sql`, `39_hero_bucket_limits_and_audit_log_read.sql`, dan `43_booking_chat_push_notifications.sql` tidak ditemukan sebagai nama migration tersendiri dalam daftar history Production yang dibaca.
- Isi beberapa file menyatakan pernah diterapkan manual/SQL Editor atau pada `yuku-staging`; ini petunjuk provenance, bukan bukti yang cukup untuk mengubah history.
- `37_optimize_rls_auth_initplan.sql` menyatakan sudah diterapkan ke yuku-staging. File itu tidak boleh diasumsikan sudah ada di Production hanya karena berada di folder migration.
- `36_close_stale_qris_submissions.sql` secara eksplisit menyebut eksekusi sekali via SQL Editor. File manual seperti ini perlu dicatat sebagai out-of-band DDL dan dibandingkan dengan schema aktif.
- `FULL_MIGRATION_V20.sql` dan `FULL_MIGRATION_V20_PARTIAL_ARCHIVE.sql` tidak ditemukan pada path yang dicoba di branch tree yang diperiksa; jangan jadikan nama arsip tersebut dasar replay.

## Next verification sequence

1. Ekspor definisi aktual Production untuk fungsi, trigger, constraint, policy, extension, cron job, dan grants yang disentuh file 28–43.
2. Diff definisi aktual dengan file SQL terkait untuk mengidentifikasi perubahan yang sama, parsial, atau sudah superseded.
3. Periksa riwayat dan error `MIGRATIONS_FAILED` pada development branch tanpa reset/rebase.
4. Susun baseline Staging baru hanya setelah estimasi biaya branch/project dikonfirmasi dan file migration canonical disepakati.
5. Jalankan replay bersih dan regression suite pada Staging; Production tetap tidak disentuh.