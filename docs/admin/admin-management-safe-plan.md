# YUKU Admin Management — Rencana Implementasi Sederhana

## Tujuan
- Pertahankan satu halaman login yang sudah ada.
- Hanya ada dua tingkatan akun: **Super Admin** dan **Admin**.
- Akun awal Super Admin: `yukusocial@gmail.com`.
- Super Admin dapat menambah/menonaktifkan Admin dan memilih menu yang boleh diakses setiap Admin.
- Satu akun Admin dapat diberi beberapa menu sekaligus. Tidak ada jenis akun Admin yang terpisah.
- Tidak memakai MFA pada tahap ini.
- Xendit tetap nonaktif dan tidak disentuh.

## Pilihan menu Admin biasa
- Talent — data Talent dan review layanan.
- Booking — pengelolaan booking.
- Keuangan — pencairan, refund, QRIS, dan affiliate.
- Support — laporan insiden dan verifikasi KTP Customer.

## Menu khusus Super Admin
- Pengaturan Admin dan pembagian akses.
- Branding.
- Poster Promo.
- Slide Hero.
- Overview.

## Aturan keselamatan
- Semua perubahan dibuat di branch terpisah.
- Tidak mengubah database Production atau Worker Production selama pengembangan dan pengujian.
- Admin biasa tidak dapat membuat/mengelola Admin lain atau mengubah Super Admin.
- Jangan mengubah status verifikasi umur atau status akun pengguna hanya untuk memberi hak Admin.
- Jangan memakai fungsi provisioning lama tanpa perbaikan; fungsi lama mengubah status verifikasi umur dan status akun.
- Pembatasan harus berlaku di database/RLS, fungsi server, dan Storage; bukan hanya menyembunyikan menu.
- Xendit tidak disentuh.
- Production hanya diubah setelah persetujuan khusus.

## Urutan pengerjaan
1. Petakan menu, pemuatan data, fungsi database, dan kebijakan akses.
2. Siapkan penyimpanan akun Super Admin/Admin dan izin menu yang dapat dicentang.
3. Terapkan pemeriksaan izin pada backend/database.
4. Perbarui halaman Admin agar hanya memuat data yang diizinkan.
5. Tambahkan pengaturan Admin khusus Super Admin.
6. Uji akses Super Admin, Admin dengan kombinasi izin, Admin tanpa izin, dan pengguna biasa.
7. Jalankan pemeriksaan build dan tes. Ajukan perubahan melalui Pull Request.
8. Production hanya diubah setelah persetujuan khusus.

## Status per 21 November 2026
- Model dua tingkatan akun telah ditetapkan.
- Migration 48 sudah diterapkan di Supabase Staging untuk fondasi akun Super Admin/Admin dan izin menu.
- Tes awal Staging lulus, termasuk uji Admin dengan satu izin dan rollback data uji.
- Pembatasan semua tabel/RPC/Storage dan penyesuaian halaman Admin masih harus dikerjakan sebelum akses terbatas benar-benar aktif.
- Belum ada perubahan kode aplikasi atau deployment.
- Production tidak disentuh.
