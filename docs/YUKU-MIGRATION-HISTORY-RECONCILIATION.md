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