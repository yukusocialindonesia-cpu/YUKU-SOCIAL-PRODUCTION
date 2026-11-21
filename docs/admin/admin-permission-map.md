# Hak Akses Admin YUKU (Sederhana)

Status: rancangan yang disepakati. Tidak ada perubahan pada Production.

## Hanya dua tingkatan akun

1. **Super Admin** — akses penuh ke semua menu dan satu-satunya pihak yang dapat mengatur akun serta hak akses Admin.
2. **Admin** — hanya satu jenis akun. Saat membuat atau mengedit akun Admin, Super Admin memilih menu yang boleh diakses. Satu Admin dapat memiliki beberapa menu sekaligus.

Tidak ada jenis akun terpisah seperti Admin Talent, Admin Booking, Admin Keuangan, atau Admin Support.

## Pilihan menu untuk Admin biasa

| Menu yang dapat dicentang | Hak akses |
|---|---|
| Talent | Data Talent dan review layanan |
| Booking | Pengelolaan booking |
| Keuangan | Pencairan, refund, QRIS, dan affiliate |
| Support | Laporan insiden dan verifikasi KTP Customer |

Menu berikut **khusus Super Admin** dan tidak dapat diberikan kepada Admin biasa:
- Pengaturan Admin dan pembagian akses
- Branding
- Poster Promo
- Slide Hero
- Overview

## Aturan akun

- Semua akun menggunakan halaman login yang sekarang.
- Super Admin awal: `yukusocial@gmail.com`.
- Super Admin dapat menambah, mengubah izin, dan menonaktifkan Admin.
- Admin biasa tidak dapat membuat Admin lain, mengubah hak akses, atau mengelola Super Admin.
- Tidak menggunakan MFA pada tahap ini.
- Xendit tetap nonaktif dan tidak disentuh.
- Memberi akses Admin tidak boleh otomatis mengubah verifikasi usia/KTP atau status akun pengguna.

## Catatan keamanan dari pemeriksaan Staging

- Saat ini aplikasi hanya mengenali role `admin`, `talent`, dan `customer`; belum ada pembagian izin Admin.
- Halaman Admin mengambil data banyak menu sekaligus. Nanti pemuatan data harus mengikuti izin Admin.
- Pembatasan wajib diterapkan di database/RLS, fungsi server, dan Storage. Menyembunyikan menu saja tidak cukup.
- Fungsi lama `provision_admin_user(UUID)` tidak boleh dipakai untuk alur baru karena ikut mengubah verifikasi usia dan status akun.
- Data KTP, rekening, dan informasi pribadi lain hanya boleh dibuka oleh Admin yang memang memerlukan menu tersebut.

## Status pengerjaan

- Pemeriksaan Staging dilakukan tanpa mengubah data.
- Dokumen ini mencatat model dua tingkatan akun dengan izin menu yang dapat dicentang.
- Belum ada perubahan skema database, kode aplikasi, atau deployment.
- Production tidak disentuh.
