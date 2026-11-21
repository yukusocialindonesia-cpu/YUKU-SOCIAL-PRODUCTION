# Peta Hak Akses Admin YUKU

Status: rancangan berdasarkan pemeriksaan read-only Production pada 21 November 2026. Dokumen ini belum mengubah aplikasi atau database.

## Prinsip

- Login tetap memakai halaman login yang sekarang.
- Akun `yukusocial@gmail.com` ditetapkan sebagai satu-satunya Super Admin awal.
- Super Admin memiliki semua hak dan dapat membuat/menonaktifkan Admin lain serta mengatur kelompok menu.
- Admin biasa hanya memperoleh kelompok yang diberikan.
- Admin biasa tidak boleh mengubah, menonaktifkan, atau menurunkan hak Super Admin.
- Tidak menggunakan MFA untuk tahap ini.
- Xendit tidak diaktifkan atau diubah.
- Status verifikasi usia/KTP dan status akun pengguna tidak boleh diubah hanya karena seseorang diberi hak Admin.

## Kelompok akses yang direncanakan

| Kelompok | Menu di AdminPage | Data/fungsi utama |
|---|---|---|
| Talent | Talent, Review Layanan | `talent_profiles`, `talent_services`, `talent_service_change_log`, `talent_identity_change_requests`, dan identitas/KTP Talent yang diperlukan untuk verifikasi |
| Booking | Booking | `bookings`, `booking_messages`, `booking_status_history`, profil pihak yang terkait dengan booking |
| Keuangan | Pencairan, Refund, QRIS & Verifikasi, Affiliate | `payout_requests`, `payments`, `refunds`, `customer_cancellation_cases`, `qris_payment_submissions`, `commission_records`, data referral dan penghasilan affiliate, serta pengaturan QRIS |
| Support | Laporan Insiden, Verifikasi KTP Customer | `reports_complaints`, identitas/KTP Customer dan data pengguna minimum yang diperlukan untuk penanganan kasus |

## Menu khusus Super Admin

Menu berikut tidak masuk ke empat kelompok Admin biasa pada tahap pertama:
- Overview, karena ringkasannya memuat angka keuangan dan operasional lintas modul.
- Poster Promo.
- Slide Hero.
- Logo & Branding.
- Pengaturan Affiliate global.
- Pengaturan Admin dan pembagian izin.

Catatan: panel Affiliate saat ini mencampur data komisi/hasil referral dengan pengaturan komisi global. Sebelum diberikan kepada Admin Keuangan, panel harus dipisahkan agar pengaturan global tetap khusus Super Admin.

## Batasan penting yang ditemukan

1. Saat ini pemeriksaan akses aplikasi hanya mengecek `role === 'admin'`.
2. Halaman Admin memuat data banyak menu sekaligus ketika dibuka. Menyembunyikan tab saja tidak cukup.
3. Fungsi database `public.is_admin()` saat ini mengizinkan semua pengguna dengan role `admin`; banyak kebijakan RLS dan fungsi RPC mengandalkannya.
4. Kebijakan RLS yang ditemukan melindungi tabel keuangan, booking, talent, identitas, laporan, promosi, branding, QRIS, dan lainnya dengan pemeriksaan Admin yang sama.
5. Kebijakan Storage juga memakai `is_admin()`, termasuk bucket dokumen KTP, bukti QRIS, poster, hero, branding, dan media Talent.
6. Fungsi RPC yang memakai pemeriksaan Admin mencakup proses payout, refund, pembatalan booking, laporan, KTP, review Talent, QRIS, dan overview. Fungsi review layanan serta perubahan identitas Talent juga perlu dipetakan dan diuji tersendiri.
7. Fungsi lama `provision_admin_user(UUID)` tidak boleh dipakai untuk alur baru karena juga mengubah `is_verified_18` dan `account_status`.

## Persyaratan implementasi sebelum Admin terbatas boleh dipakai

- Simpan jenis akun Super Admin/Admin dan izin modul di database dengan aturan yang tidak bisa diubah Admin biasa.
- Sumber identitas Super Admin harus ditetapkan dengan aman; jangan hanya mengandalkan email dari frontend.
- Buat pemeriksaan izin server/database per kelompok, bukan hanya per menu.
- Terapkan pemeriksaan izin ke semua jalur baca/tulis RLS, RPC, dan Storage yang relevan.
- Pecah pemuatan data Admin berdasarkan izin/menu agar halaman tidak mengambil data yang tidak diizinkan.
- Batasi data pribadi sensitif (KTP, nomor rekening, alamat, kontak) hanya kepada kelompok yang benar-benar membutuhkannya.
- Catat pembuatan Admin, perubahan izin, penonaktifan Admin, dan tindakan sensitif ke audit log.
- Uji menggunakan akun Super Admin, Admin dengan satu kelompok, Admin tanpa izin, dan akun Customer/Talent.
- Pastikan Admin biasa tidak dapat mengubah hak Admin lain atau Super Admin melalui API langsung.

## Status perubahan

- Pemeriksaan Production dilakukan read-only.
- Tidak ada perubahan pada data, skema, fungsi, kebijakan RLS, Storage, atau konfigurasi Production.
- Belum ada perubahan kode aplikasi pada tahap pemetaan ini.
- Tidak ada deployment.
