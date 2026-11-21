# Audit Pemetaan Akses Admin YUKU — Staging

Tanggal: 21 November 2026
Lingkungan yang diperiksa: Supabase Staging
Status: audit read-only; belum mengubah policy lama.

## Model akses yang disepakati
Hanya dua level akun:
- `super_admin`: akses penuh dan mengatur akun Admin.
- `admin`: satu jenis akun dengan kombinasi izin menu yang dicentang Super Admin.

Pilihan izin Admin:
- `talent`: data Talent dan review layanan.
- `booking`: pengelolaan booking.
- `finance`: pencairan, refund, QRIS, affiliate.
- `support`: laporan insiden dan verifikasi KTP Customer.

Khusus Super Admin:
- Pengaturan Admin
- Branding
- Poster
- Slide Hero
- Overview

## Temuan penting dari policy lama

Policy lama memakai `is_admin()` generik. Artinya, jika hanya menyembunyikan menu di frontend, Admin masih dapat mengakses data melalui API langsung.

Tabel/policy yang harus dipetakan ulang:

| Area | Tabel / policy lama | Izin tujuan |
|---|---|---|
| Talent | `talent_profiles`, `talent_services`, `talent_service_change_log`, `talent_identity_change_requests`, `reviews`, `talent_media` (akses admin) | Talent |
| Booking | `bookings`, `booking_messages`, `booking_status_history` (akses admin) | Booking |
| Keuangan | `payout_requests`, `payout_earnings_allocations`, `payments` (akses admin), `refunds`, `customer_cancellation_cases`, `customer_cancellation_case_decisions`, `commission_records`, `financial_adjustments_reversals`, `qris_payment_submissions`, `qris_payment_audit_logs`, `qris_payment_settings`, `talent_earnings`, `talent_affiliate_earnings`, `referral_relationships`, `referral_rewards`, `affiliate_settings` | Keuangan |
| Support | `reports_complaints`, `user_identities` untuk Customer | Support |
| Super Admin | `site_branding`, `promotions`, `hero_slides`, `affiliate_settings` pengaturan global, `activity_categories`, ringkasan dashboard, log dan pengaturan Admin | Super Admin |
| Akun / lintas modul | `users`, `customer_profiles`, `notifications`, `admin_audit_logs` | Perlu pembatasan khusus dan data minimal |

## Temuan RPC sensitif

RPC berikut saat ini menggunakan pemeriksaan Admin generik dan perlu izin spesifik di dalam fungsi:
- Keuangan: `admin_process_payout`, `admin_process_refund`, `admin_resolve_customer_cancellation_case`, `admin_review_qris_payment`, `admin_update_qris_settings`.
- Booking: fungsi perubahan status booking / penanganan booking yang memakai Admin generik (perlu inventaris lanjutan).
- Talent: `admin_review_talent` dan RPC review Talent/layanan/identitas terkait (perlu inventaris lanjutan).
- Support: `admin_review_ktp` hanya untuk KTP Customer; jika juga dipakai untuk Talent, fungsi perlu memeriksa tipe akun target secara eksplisit. `admin_resolve_report`.
- Super Admin: `get_admin_dashboard_overview`, pengaturan global affiliate, serta seluruh pengelolaan akun dan izin Admin.

Semua fungsi `SECURITY DEFINER` harus diperiksa body, hak EXECUTE, search_path, dan jalur pemanggilannya. Mengganti policy tabel saja tidak cukup jika RPC masih memeriksa `is_admin()` generik.

## Temuan Storage

Policy Storage yang perlu dipisah:
- `ktp-documents`: saat ini pemilik atau Admin generik dapat membaca. Support hanya boleh membaca KTP Customer; Talent perlu akses terpisah untuk dokumen Talent.
- `qris-payment-proofs`: Finance, selain pemilik Customer.
- `qris-payment-display`: konfigurasi/tampilan QRIS harus Super Admin kecuali keputusan produk menyatakan Admin Finance boleh mengubahnya.
- `branding`, `hero`, `promotions`: Super Admin.
- `talent-media`: aturan publik/pemilik tetap dipertahankan; jangan menghapus akses pemilik Talent.

## Risiko desain yang wajib diselesaikan sebelum mengubah policy

1. **Policy PostgreSQL digabung dengan OR.** Menambah policy baru yang lebih ketat tidak membatalkan policy lama yang masih mengizinkan `is_admin()`. Policy lama harus diganti/dihapus dengan rencana yang mencakup semua jalur.
2. **Kolom sensitif dalam tabel yang sama.** `bookings` menyimpan informasi booking sekaligus nilai uang. RLS hanya membatasi baris, bukan kolom. Admin Booking tidak boleh otomatis menerima semua kolom keuangan; perlu view/RPC dengan daftar kolom minimal atau pemisahan akses yang aman.
3. **Data identitas.** `user_identities` berisi KTP, tanggal lahir, dan nomor darurat. Support hanya untuk Customer; izin Talent tidak boleh membuka identitas Customer, dan sebaliknya.
4. **Tabel users.** Policy Admin generik berpotensi memberi akses kolom email/status akun lintas modul. Perlu query/view minimal atau RPC yang membatasi data.
5. **Data keuangan terkait booking.** Booking admin perlu melihat status operasional booking, tetapi bukan berarti boleh membaca bukti bayar, rekening payout, refund, atau seluruh detail pendapatan.
6. **Alur otomatis aplikasi.** Trigger, fungsi internal, peserta booking, dan kepemilikan data biasa harus tetap berjalan setelah perubahan izin.

## Rencana aman berikutnya

1. Inventaris lengkap definisi RPC yang memakai `is_admin()`, termasuk trigger dan hak EXECUTE.
2. Petakan setiap policy lama satu per satu ke izin baru, sambil mempertahankan akses Customer/Talent sebagai pemilik data.
3. Tentukan kolom minimal yang terlihat di menu Booking dan menu lain.
4. Pisahkan akses KTP Customer dari KTP Talent, termasuk Storage.
5. Siapkan satu migrasi Staging yang mengganti policy lama secara lengkap dan atomik.
6. Uji Admin dengan satu izin, kombinasi izin, Admin nonaktif, Super Admin, Customer, Talent, serta akses langsung REST/Storage.
7. Jalankan alur booking dan finansial end-to-end sebelum perubahan dianggap aman.

## Batas perubahan saat ini
- Fondasi tabel akun dan fungsi pembaca izin sudah diterapkan di Staging melalui migration 48.
- Tes fondasi dasar lulus.
- Policy lama, RPC bisnis, Storage, halaman Admin, dan Production belum diubah.
- Jangan menerapkan pembatasan frontend saja sebagai pengganti keamanan database.
