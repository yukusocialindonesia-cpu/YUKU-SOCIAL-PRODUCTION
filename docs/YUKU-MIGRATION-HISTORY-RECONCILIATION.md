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