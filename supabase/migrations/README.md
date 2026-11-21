# Panduan Migration Supabase YUKU

Dokumen ini menjelaskan cara aman membaca dan mengelola SQL migration. **Jangan menggunakan dokumen historis lama sebagai bukti bahwa migration sudah atau belum diterapkan.**

## Prinsip utama

1. Migration file di GitHub menjelaskan perubahan yang direncanakan; file itu tidak membuktikan SQL sudah dijalankan.
2. Migration history pada project Supabase yang dituju dan skema aktual adalah sumber kebenaran.
3. Selalu pastikan project ref sebelum menjalankan perintah. Production YUKU yang diketahui pada 21 November 2026 menggunakan project ref `sbqvltqzzcsqzijgumld`; verifikasi ulang sebelum tindakan.
4. Jangan menjalankan semua file SQL secara massal pada Production.
5. Jangan mengedit file migration yang sudah diterapkan. Buat migration baru untuk perubahan lanjutan.
6. Jangan menjalankan `supabase/FULL_MIGRATION_V20.sql`; file tersebut sudah dipensiunkan dan hanya berisi peringatan.
7. Jangan menjalankan SQL ke Production tanpa persetujuan eksplisit pemilik proyek.

## Migration yang diketahui diterapkan pada Production

Berikut checkpoint yang telah diverifikasi dalam pekerjaan proyek pada 21 November 2026. Daftar ini **bukan** daftar lengkap seluruh migration Production:

| Versi | Nama | Catatan |
|---|---|---|
| `20261121105125` | community MVP | Tabel dan fondasi fitur komunitas |
| `20261121105216` | community moderation helper private | Helper moderasi privat |
| `20261121105232` | community FK indexes | Indeks foreign key komunitas |
| `20261121110017` | fix activity categories anon read | Memperbaiki pembacaan kategori aktif oleh anon |
| `20261121110823` | allow public RLS permission checks | Memberi EXECUTE helper pemeriksaan admin untuk evaluasi policy baca publik |

Affiliate juga memiliki migration yang tercatat di repository:
- `20261120212637` — `45_affiliate_commission_settings`
- `20261120215322` — `yuku_46_affiliate_earnings_payout_integration`
- `20261120215324` — `yuku_47_affiliate_ledger_indexes`

Jangan menganggap daftar di atas menggantikan pemeriksaan migration history langsung. Jika history, nama file, dan skema berbeda, hentikan tindakan dan rekonsiliasikan perbedaannya terlebih dahulu.

## Prosedur pemeriksaan sebelum migration

1. Pastikan target project dan environment.
2. Ambil migration history aktual.
3. Periksa tabel, kolom, enum, index, function, trigger, GRANT, RLS policy, dan storage policy yang terkait.
4. Baca migration sebelumnya dan semua fungsi/pemanggil yang bergantung padanya.
5. Periksa apakah migration aman dijalankan ulang atau tidak; jangan mengasumsikan idempotent.
6. Jalankan test di lingkungan non-production bila tersedia.
7. Tulis migration baru yang kecil, jelas, dan punya tujuan tunggal.
8. Dapatkan persetujuan sebelum menerapkan pada Production.
9. Setelah diterapkan, verifikasi hasil menggunakan query baca-saja dan test role yang aman.

## Keamanan Supabase

- RLS harus aktif pada tabel di schema exposed.
- GRANT dan RLS adalah lapisan berbeda: GRANT mengizinkan akses objek; RLS membatasi baris.
- Jangan memperluas EXECUTE fungsi `SECURITY DEFINER` tanpa memeriksa isi fungsi, pemilik, `search_path`, dan role pemanggil.
- Jangan menghapus policy atau memperlonggar akses untuk sekadar menghilangkan error.
- UPDATE membutuhkan policy SELECT yang sesuai serta `USING` dan `WITH CHECK`.
- Jangan gunakan service_role key pada frontend.
- Jangan memakai data identitas, booking, atau keuangan Production untuk test yang mengubah data.

## Test dan pemeriksaan

Repository memiliki SQL test di `supabase/tests/` dan pemeriksaan operasional di `supabase/ops/post_deploy_checks.sql`. Baca isi test sebelum menjalankan; pahami apakah test hanya membaca data atau membuat fixture/perubahan sementara.

Hasil test harus dilaporkan dengan jelas:
- project/environment yang diuji,
- role database yang digunakan,
- objek yang diperiksa,
- apakah transaksi di-rollback,
- hasil yang benar-benar terlihat,
- hal yang belum diuji.

## Catatan fitur keuangan

Booking, payment, escrow, komisi, affiliate, refund, dan payout merupakan data sensitif. Status database tidak membuktikan dana benar-benar berpindah. Refund/payout harus mengikuti proses provider/bank dan bukti referensi transaksi. Jangan mengubah konfigurasi Xendit atau payment provider tanpa persetujuan eksplisit.

## File rujukan

- `supabase/migrations/` — migration SQL.
- `supabase/tests/` — SQL test.
- `supabase/ops/` — pemeriksaan operasional.
- `docs/PRODUCTION_SAFETY.md` — batas tindakan Production.
- `docs/FEATURE_STATUS.md` — status fitur yang pernah diverifikasi.
