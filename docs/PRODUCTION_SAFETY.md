# Aturan Aman Mengelola YUKU Production

Dokumen ini adalah batas operasional untuk AI/developer. Jika instruksi lain bertentangan, berhenti dan minta persetujuan pemilik proyek.

## Lingkungan yang diketahui

- Repository: `yukusocialindonesia-cpu/YUKU-SOCIAL-PRODUCTION`
- Branch utama: `main`
- Supabase Production project ref yang diketahui: `sbqvltqzzcsqzijgumld`
- Layanan aplikasi Production: Cloudflare Worker `yuku-friends`
- Vercel bukan target deployment aktif pada checkpoint dokumentasi ini.
- Staging sebelumnya dihentikan; jangan menganggap tersedia staging aktif.

Informasi ini perlu diverifikasi ulang sebelum tindakan operasional karena konfigurasi dapat berubah.

## Tindakan yang memerlukan persetujuan eksplisit

- Menjalankan SQL atau migration pada Supabase Production.
- Mengubah RLS, GRANT, fungsi, trigger, storage policy, auth settings, atau data.
- Mengubah secrets/environment variable, domain, DNS, worker, atau konfigurasi deployment.
- Mengaktifkan atau mengubah checkout, payment gateway, webhook, Xendit, QRIS, refund, payout, escrow, atau komisi.
- Menghapus data, tabel, file, branch, workflow, atau resource.
- Merge/deploy perubahan yang berdampak ke Production.

Persetujuan untuk satu tindakan tidak otomatis menjadi izin untuk tindakan lain.

## Prosedur perubahan kode

1. Pastikan branch dan commit dasar.
2. Periksa implementasi dan semua pemanggil.
3. Buat branch khusus dengan ruang lingkup kecil.
4. Jalankan pemeriksaan TypeScript/build dan test relevan.
5. Tinjau diff, file sensitif, dan dampak database.
6. Minta persetujuan sebelum merge bila perubahan berdampak ke Production.
7. Setelah merge, verifikasi deployment secara terpisah.
8. Jangan mengklaim UI benar tanpa uji browser/screenshot aktual.

## Prosedur database

1. Identifikasi project ref dan pastikan benar-benar Production atau bukan.
2. Ambil status migration history dan skema aktual dengan query baca-saja.
3. Periksa tabel, fungsi, trigger, GRANT, RLS, dan dependensi yang terdampak.
4. Buat migration baru; jangan mengedit migration yang sudah diterapkan.
5. Uji di lingkungan non-production yang tersedia. Jika tidak ada, jangan berpura-pura staging telah diuji.
6. Dapatkan persetujuan eksplisit sebelum eksekusi Production.
7. Verifikasi hasil setelah perubahan dengan query baca-saja dan test role yang aman.

Jangan menjalankan seluruh folder migration secara massal pada Production. Jangan menjalankan file legacy/pensiun seperti `supabase/FULL_MIGRATION_V20.sql`.

## Keamanan Supabase

- RLS wajib dipertahankan pada tabel exposed.
- GRANT dan RLS adalah dua lapisan berbeda: GRANT memberi akses ke objek; RLS membatasi baris.
- Jangan menambahkan EXECUTE ke fungsi SECURITY DEFINER tanpa review isi fungsi, search_path, pemilik, dan dampak role.
- Jangan memakai user-editable metadata sebagai dasar otorisasi.
- UPDATE policy perlu SELECT policy yang sesuai serta USING dan WITH CHECK.
- Jangan membuka dokumen identitas/KTP, data pribadi, saldo, atau informasi booking lintas pengguna.
- Jangan menaruh service_role key atau secret di frontend.

## Area keuangan dan provider

Perubahan berikut selalu dianggap sensitif:
- `bookings`, `payments`, `refunds`
- `commission_records`, `talent_earnings`
- `payout_requests`, `payout_earnings_allocations`
- `referral_relationships`, `referral_rewards`
- feature flags pembayaran dan konfigurasi provider

Jangan menyimpulkan uang telah berpindah hanya karena status database berubah. Refund/payout perlu bukti provider/bank dan referensi transaksi sesuai alur yang disetujui.

**Xendit:** jangan mengubah integrasi, secret, webhook, konfigurasi, atau statusnya tanpa instruksi eksplisit pemilik proyek.

## Pelaporan akhir wajib

Setiap pekerjaan harus melaporkan:
- Perubahan kode/database/config yang dilakukan (atau tegaskan tidak ada).
- Environment yang disentuh.
- Test yang benar-benar dijalankan dan hasilnya.
- Apa yang belum diuji.
- Risiko dan langkah berikutnya.
