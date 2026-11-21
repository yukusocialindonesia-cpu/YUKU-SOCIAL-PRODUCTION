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

## Hasil pemeriksaan lanjutan: RPC, trigger, dan hak pemanggilan

Ditemukan 20 fungsi database yang definisinya memanggil `public.is_admin()`. Tidak semuanya merupakan endpoint Admin; beberapa adalah trigger/validasi internal aplikasi. Karena itu, jangan mengganti isi `public.is_admin()` secara global menjadi Super Admin atau membatasi semua pemanggilannya ke satu izin.

### RPC yang dipanggil langsung oleh frontend dan harus diberi izin spesifik

| Fungsi | Izin yang dituju | Catatan |
|---|---|---|
| `admin_process_payout` | Keuangan | Memproses pencairan dana |
| `admin_process_refund` | Keuangan | Memproses refund |
| `admin_resolve_customer_cancellation_case` | Keuangan | Mengambil keputusan kasus pembatalan yang berdampak pada dana |
| `admin_review_qris_payment` | Keuangan | Menyetujui/menolak bukti pembayaran QRIS |
| `admin_update_qris_settings` | Keuangan | Mengubah pengaturan QRIS |
| `admin_resolve_report` | Support | Menangani laporan; dapat menahan/melepas booking terkait sesuai prosedur |
| `admin_review_talent` | Talent | Menyetujui/menolak profil Talent |
| `review_talent_identity_change` | Talent | Meninjau perubahan identitas Talent |
| `review_talent_service` | Talent | Meninjau layanan Talent |
| `admin_review_ktp` | Talent atau Support sesuai jenis pemilik KTP | Fungsi lama dipakai oleh alur Talent dan juga dapat meninjau KTP Customer. Harus membedakan role target di database, bukan mengandalkan UI. |
| `get_admin_dashboard_overview` | Super Admin | Mengembalikan ringkasan lintas modul. |

Fungsi-fungsi di atas saat ini memberikan hak EXECUTE kepada `authenticated` dan beberapa menggunakan `SECURITY DEFINER`; maka pemeriksaan izin wajib berada di dalam fungsi. RLS tabel tidak melindungi dari RPC yang berjalan sebagai definer bila fungsi hanya memeriksa `is_admin()` generik.

### Fungsi internal yang tidak boleh dibatasi secara sembarang

Fungsi berikut juga memakai `is_admin()`, tetapi berperan sebagai trigger/validasi atau proses internal:
- `guard_booking_status_actor`
- `handle_payout_status_update`
- `log_booking_status_change`
- `prevent_user_security_column_tampering`
- `process_escrow_release`
- `protect_and_verify_user_identities`
- `restrict_notification_update`
- `validate_booking_update`
- `validate_referral_relationship`

Pemeriksaan trigger harus dibedakan dari otorisasi endpoint Admin. Perubahan trigger dapat memutus pembaruan booking, escrow, payout, referral, atau perlindungan akun biasa. Fungsi internal tersebut perlu diuji melalui alur normal, bukan sekadar diberi izin menu.

### Halaman Admin saat ini

Audit kode `AdminPage.tsx` menemukan satu fungsi pemuatan data yang mengambil semua modul sekaligus, termasuk:
- data profil dan KTP Talent;
- antrean review layanan dan perubahan identitas;
- pencairan, booking, refund, dan kasus pembatalan;
- KTP Customer;
- laporan insiden;
- poster promosi.

Dashboard bagian atas juga menggabungkan angka Talent, payout, pendapatan, dan GMV. Menu Branding, Hero, QRIS, dan Affiliate menggunakan panel terpisah.

Konsekuensi: setelah pembatasan database, halaman ini harus diubah agar:
1. Memuat daftar izin melalui `get_admin_access()`.
2. Menampilkan hanya menu yang diizinkan.
3. Memuat data hanya untuk modul yang diizinkan.
4. Tidak menampilkan metrik lintas modul kepada Admin biasa.
5. Menampilkan pengaturan Admin, branding, poster, hero, dan overview hanya untuk Super Admin.

### Keputusan implementasi

- Jangan mengubah `public.is_admin()` secara global karena dipakai trigger/validasi.
- Ubah policy RLS endpoint per tabel dengan mempertahankan aturan pemilik/peserta.
- Pisahkan KTP Customer dan Talent berdasarkan role target.
- Batasi RPC sensitif di dalam fungsi.
- Berikan Booking akses operasional minimal; jangan menganggap izin Booking sebagai izin Finance untuk detail payout/refund/bukti pembayaran.
- Buat tampilan data booking yang kolomnya minimal karena RLS tidak menyaring kolom.
- Terapkan policy Storage berdasarkan jenis file dan role pemilik.

## Implementasi lanjutan Staging — 21 November 2026

### Database dan RPC
Migrasi 49–63 telah diterapkan di Staging. Ini termasuk penguatan trigger scoped Admin (`62_scoped_admin_trigger_guard_hardening`), pemeliharaan trigger KTP tepercaya (`63_trusted_ktp_trigger_maintenance`), dan indeks foreign key akun Admin (`62_index_admin_audit_actor_foreign_keys`):
- Policy Talent, Finance, Support, Booking operasional, dan Super Admin dipisahkan.
- RPC bisnis sensitif kini memeriksa izin menu di dalam fungsi, bukan hanya role Admin.
- KTP Customer dan Talent dibedakan berdasarkan role pemilik.
- Storage KTP, bukti QRIS, gambar QRIS, branding, hero, poster, dan media Talent dibatasi sesuai menu.
- Tabel `bookings` tidak lagi dapat dibaca langsung oleh Admin biasa. Menu Booking memakai `get_admin_bookings()` yang hanya mengembalikan kolom operasional, tanpa nominal transaksi atau fee.
- Data email/status akun hanya disediakan lewat RPC ringkas yang membatasi target sesuai izin.
- `is_admin()` tidak lagi dapat dipanggil oleh pengguna anonim; fungsi trigger internal tetap dipertahankan dan tidak dapat dipanggil langsung oleh authenticated.

### Hasil pengujian
- Admin Talent: izin Talent aktif; Finance/Booking/Support tidak aktif.
- Admin Finance: dapat membaca data payout dan label transaksi melalui RPC, tetapi tidak dapat membaca tabel booking secara langsung.
- Admin Support: dapat membaca antrean laporan dan KTP Customer; KTP Talent tidak terbuka.
- Admin Booking: RPC daftar booking mengembalikan data operasional saja; akses langsung ke `bookings` menghasilkan nol baris.
- Admin nonaktif: `get_admin_access()` mengembalikan `is_admin=false` dan daftar izin kosong.
- Super Admin: tetap memiliki keempat izin dan dapat membuka daftar akun Admin.
- Pengujian memakai perubahan akun sementara dalam transaksi dan seluruhnya di-rollback.

### Pengelolaan Admin
- RPC Super Admin untuk daftar akun, mengatur beberapa izin sekaligus, dan menonaktifkan/mengaktifkan Admin telah dibuat dan diuji.
- Edge Function `admin-management` telah aktif di Supabase Staging dengan verifikasi JWT wajib.
- Panel Pengaturan Admin telah ditambahkan ke frontend pada branch ini. Undangan nyata belum dikirim dan belum ada akun Admin baru dibuat.

### Frontend
- AuthContext memuat izin dari `get_admin_access()`; jika gagal, akses Admin ditutup.
- AdminPage hanya memuat data dan menampilkan menu sesuai izin.
- Metrik gabungan keuangan hanya terlihat oleh Super Admin.
- Admin Booking tidak menerima kolom nominal, fee, atau bagian Talent.
- QRIS Admin mengambil status booking melalui RPC Finance, bukan tabel booking langsung.

### Batas yang masih berlaku
- Production tidak diubah dan tidak dideploy.
- Branch belum digabung ke main.
- Xendit tetap tidak disentuh.
- Belum ada email undangan yang dikirim.
- Status GitHub Actions untuk commit terbaru belum dapat diverifikasi melalui hasil yang tersedia. Pemeriksaan status commit menunjukkan Vercel Preview tertahan karena batas penggunaan/build (`build-rate-limit`); ini bukan bukti bahwa build berhasil atau gagal pada kode. Jangan menyatakan build/lint lulus sebelum workflow CI benar-benar terkonfirmasi.
- Advisor masih menampilkan peringatan umum untuk SECURITY DEFINER yang memang dipakai endpoint terotorisasi, serta peringatan Auth leaked-password protection yang merupakan pengaturan lama. Empat tabel tanpa policy RLS sengaja tertutup dari akses langsung.

### Pemeriksaan akhir tambahan
- Migrasi 62 menambahkan indeks untuk dua foreign key baru pada tabel Admin; jumlah temuan foreign key tanpa indeks turun dari 19 menjadi 17. Sisa 17 berasal dari tabel aplikasi yang sudah ada sebelumnya.
- Definisi `public.is_admin()` yang aktif di Staging hanya mengenali Super Admin; akses Admin biasa menggunakan pemeriksaan izin per menu. Hak EXECUTE `is_admin()` untuk anon juga sudah dicabut.
- Pemeriksaan trigger memastikan proses KTP menggunakan izin sesuai jenis akun; proses booking dan payout memakai izin Booking/Finance/Support sesuai tindakan.
- Security advisor masih memberi peringatan umum pada fungsi SECURITY DEFINER yang memang dapat dipanggil authenticated, tetapi endpoint Admin baru memeriksa identitas dan izin di dalam fungsi. Peringatan anon yang tersisa adalah `is_talent_publicly_visible` untuk katalog publik. Peringatan perlindungan password bocor adalah pengaturan Auth yang sudah ada sebelumnya dan belum diubah.
- Tes RPC KTP menegaskan Talent tidak dapat memproses KTP Customer dan Support tidak dapat memproses KTP Talent. Untuk jenis yang benar, fungsi lolos pemeriksaan izin lalu menolak karena dokumen uji sudah berstatus verified, sehingga tidak ada data yang berubah.
- Tes pengelolaan Admin mengonfirmasi daftar akun, kombinasi izin, penonaktifan, dan provisioning service-role. Semua perubahan akun uji di-rollback.


### Catatan validitas pengujian RLS
- Simulasi akses RLS melalui SQL Editor harus menjalankan `SET LOCAL ROLE authenticated` setelah mengatur klaim JWT. Jika query dijalankan sebagai postgres tanpa pergantian role, RLS dapat dilewati sehingga hasil hitungan bukan bukti pembatasan akses pengguna.
- Pengujian tambahan pada 21 November 2026 dilakukan dengan role `authenticated` dan akun Admin sementara Support-only. Hasil: izin Support aktif, Finance/Talent tidak aktif, `public.is_admin()` false, tabel payout dan booking tidak menampilkan baris untuk Admin Support, serta satu dokumen KTP yang sesuai cakupan izin terlihat. Seluruh perubahan akun uji di-rollback.
- RPC daftar booking dan proses refund diuji dari role `authenticated` untuk memastikan Admin Support-only ditolak. Tidak ada transaksi bisnis atau data produksi yang diubah.
