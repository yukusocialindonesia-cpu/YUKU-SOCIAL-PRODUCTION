# YUKU Admin Management — Safe Implementation Plan

## Tujuan
- Pertahankan satu halaman login yang sudah ada.
- Akun pemilik `yukusocial@gmail.com` menjadi Super Admin.
- Super Admin dapat membuat, menonaktifkan, dan mengatur hak akses Admin lain.
- Admin biasa hanya dapat membuka bagian yang ditugaskan.
- Tidak memakai MFA pada tahap ini.
- Xendit tetap nonaktif dan tidak disentuh.

## Kondisi yang ditemukan
- Aplikasi saat ini hanya mengenali role `admin`, `talent`, dan `customer`.
- Halaman Admin memeriksa `role === 'admin'`.
- Halaman Admin mengambil data banyak modul sekaligus saat dibuka, bukan hanya data tab yang sedang dipilih.
- Database memiliki banyak kebijakan akses yang memakai `is_admin()`. Mengubah tampilan menu saja tidak cukup untuk membatasi akses.

## Kelompok akses awal
1. Keuangan — pencairan, refund, dan data keuangan.
2. Booking — daftar booking dan penanganan pembatalan.
3. Talent — verifikasi talent, layanan, dan identitas.
4. Support — laporan, keluhan, dan bantuan pengguna.

Super Admin mendapat seluruh akses serta menu Pengaturan Admin. Admin biasa tidak boleh mengubah, menonaktifkan, atau menurunkan hak Super Admin.

## Aturan keselamatan
- Semua perubahan dibuat di branch terpisah.
- Tidak mengubah database Production atau Worker Production selama tahap pengembangan.
- Jangan mengubah status verifikasi umur atau status akun pengguna hanya untuk memberi hak Admin.
- Jangan memakai fungsi provisioning lama tanpa perbaikan; fungsi lama mengubah status verifikasi umur dan status akun.
- Jangan menyatakan pembatasan aman sebelum semua akses database dan fungsi sensitif sudah diperiksa serta diuji.
- Xendit tidak disentuh.

## Urutan pengerjaan
1. Petakan menu, pemuatan data, fungsi database, dan kebijakan akses untuk setiap kelompok.
2. Siapkan penyimpanan hak akses Admin dan fungsi pemeriksaan akses di database.
3. Terapkan pemeriksaan akses pada backend/database, bukan hanya menyembunyikan menu.
4. Perbarui halaman Admin agar hanya memuat data sesuai hak akses.
5. Tambahkan halaman Pengaturan Admin khusus Super Admin.
6. Uji akses Super Admin, Admin dengan izin terbatas, dan pengguna biasa.
7. Jalankan pemeriksaan build dan tes. Ajukan perubahan melalui Pull Request untuk ditinjau.
8. Production hanya diubah setelah persetujuan khusus.

## Status
Dokumen perencanaan saja. Belum ada perubahan kode aplikasi, database, atau Production.
