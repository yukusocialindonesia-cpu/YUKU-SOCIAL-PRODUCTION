# Rancangan Pengamanan Database Admin YUKU

Status: fondasi awal sudah diterapkan dan diuji di Staging. Pembatasan seluruh RLS/RPC/Storage dan UI masih dalam pengerjaan. Production belum disentuh.

## Tujuan

Membuat hak akses Admin benar-benar dibatasi di database, bukan hanya menyembunyikan tab pada halaman Admin. Rancangan ini mengikuti prinsip Supabase RLS: setiap tabel, fungsi, dan file Storage harus memeriksa izin yang sesuai.

## Bentuk data yang disarankan

Gunakan skema database non-publik (misalnya `private`) agar tabel pengaturan hak akses tidak menjadi endpoint Data API langsung.

### 1. Daftar akun Admin

`private.admin_accounts`
- `user_id` UUID sebagai kunci dan relasi ke `auth.users`.
- `admin_level` hanya `super_admin` atau `admin`.
- `is_active` untuk menonaktifkan Admin.
- `created_at`, `created_by`, `updated_at`.

Akun Super Admin awal ditetapkan melalui migrasi tepercaya menggunakan UUID akun yang sudah diverifikasi. Jangan menjadikan email dari browser atau `user_metadata` sebagai bukti hak Super Admin.

### 2. Izin per kelompok

`private.admin_permissions`
- `admin_user_id` UUID.
- `permission_key` salah satu: `talent`, `booking`, `finance`, `support`.
- Primary key gabungan `(admin_user_id, permission_key)`.

Super Admin tidak memerlukan baris izin satu per satu karena memiliki seluruh hak. Admin biasa hanya mendapat izin yang tersimpan.

## Fungsi pemeriksaan izin

Buat fungsi internal yang:
- Mengambil identitas dari `auth.uid()`, bukan dari parameter yang bisa dipalsukan oleh browser.
- Memastikan akun Admin aktif.
- Memberi akses penuh hanya kepada akun berlevel `super_admin`.
- Memeriksa izin kelompok untuk Admin biasa.
- Menolak akses jika pengguna tidak login, tidak terdaftar sebagai Admin, atau Admin dinonaktifkan.

Fungsi yang perlu dipanggil oleh RLS sebaiknya ditempatkan di skema non-publik, memakai `SECURITY DEFINER` hanya bila memang diperlukan untuk membaca tabel internal, mengunci `search_path`, memvalidasi `auth.uid()` di dalam fungsi, serta memberikan hak EXECUTE secara eksplisit. Jangan membuka fungsi administrasi internal ke `anon`.

Jangan gunakan `raw_user_meta_data` untuk otorisasi. `app_metadata` lebih aman dari perubahan oleh pengguna, tetapi pencabutan akses di database tetap perlu dipastikan berlaku tanpa menunggu token lama kedaluwarsa. Karena itu, keputusan akses utama disarankan membaca status akun dan izin aktif dari database.

## Peta penerapan izin

| Area database | Izin yang harus diwajibkan |
|---|---|
| Talent profiles, services, review, perubahan identitas Talent | `talent` |
| Booking, pesan booking, riwayat status, data pihak booking yang diperlukan | `booking` |
| Payout, earnings, payment, refund, pembatalan terkait dana, QRIS, komisi dan referral | `finance` |
| Laporan/keluhan dan verifikasi identitas Customer | `support` |
| Promosi, hero slides, branding, pengaturan affiliate global, pengaturan Admin | Super Admin |
| Ringkasan dashboard lintas modul | Super Admin pada tahap pertama |

Kepemilikan data pengguna biasa dan akses publik tetap harus dipertahankan. Jangan mengganti semua kebijakan menjadi pemeriksaan izin Admin saja; kebijakan peserta booking, pemilik data, dan visibilitas publik harus tetap bekerja.

## Fungsi RPC yang harus diperketat

Setiap fungsi harus memeriksa izin spesifik di dalam fungsi, bukan hanya mengandalkan tombol UI:
- Finance: `admin_process_payout`, `admin_process_refund`, `admin_resolve_customer_cancellation_case`, `admin_review_qris_payment`, dan fungsi perubahan pengaturan pembayaran.
- Booking: tindakan Admin yang mengubah status atau menyelesaikan sengketa booking.
- Talent: `admin_review_talent`, `admin_review_talent_profile`, `admin_review_ktp`, `review_talent_identity_change`, `review_talent_service`.
- Support: `admin_resolve_report` dan tindakan verifikasi KTP Customer.
- Overview: `get_admin_dashboard_overview` hanya Super Admin sampai ringkasan datanya dapat dipisah dengan aman.

Fungsi trigger/internal seperti validasi booking dan proses escrow tidak boleh diberi izin Admin berdasarkan kategori secara sembarang. Audit satu per satu agar operasi otomatis aplikasi tetap berjalan.

## Storage

Batasi file berdasarkan jenis:
- KTP Customer: Support.
- Dokumen identitas Talent: Talent.
- Bukti QRIS dan dokumen terkait pembayaran: Keuangan.
- Branding, poster, hero: Super Admin.
- Media Talent milik Talent tetap mengikuti aturan pemilik file; izin Admin tidak boleh menghilangkan aturan pemilik.

Akses unduh file privat juga harus diperiksa, bukan hanya hak upload/hapus.

## Pembuatan dan pengelolaan Admin

Pembuatan Admin perlu melalui jalur server tepercaya:
1. Super Admin meminta pembuatan akun.
2. Server memverifikasi sesi dan memastikan pemohon adalah Super Admin aktif.
3. Akun Auth dibuat/diundang dengan aman.
4. Catatan Admin dan izin awal dibuat dalam satu alur yang konsisten.
5. Setiap perubahan izin, penonaktifan, atau penghapusan dicatat pada `admin_audit_logs`.

Admin biasa tidak boleh mengubah baris akun/izin Admin, mengangkat dirinya, mengubah level Admin lain, atau menyentuh Super Admin. Pengaman ini harus berada di database/server, bukan hanya UI.

Jangan memakai RPC lama `provision_admin_user(UUID)`: fungsi itu mengubah status verifikasi usia dan status akun pengguna, yang bukan bagian dari pemberian hak Admin.

## Urutan pengerjaan yang aman

1. Selesaikan inventaris seluruh tabel, RLS, RPC, trigger, dan Storage yang terkait Admin.
2. Buat migrasi skema internal dan fungsi izin di lingkungan Staging saja.
3. Buat tes otomatis: Super Admin lolos semua modul; Admin satu kelompok hanya lolos kelompoknya; Admin nonaktif ditolak; Customer/Talent ditolak dari operasi Admin; Admin biasa tidak bisa mengubah akun/izin Super Admin.
4. Uji semua alur pengguna biasa, booking, pembayaran, payout, refund, QRIS, verifikasi, dan upload file agar tidak rusak.
5. Pecah pemuatan data di halaman Admin sesuai izin.
6. Jalankan pemeriksaan keamanan Supabase dan seluruh build/test.
7. Tinjau hasil sebelum meminta persetujuan terpisah untuk penerapan Production.

## Catatan penting dari pemeriksaan

- Production menggunakan `public.is_admin()` pada banyak kebijakan RLS dan fungsi.
- Storage juga menggunakan pemeriksaan Admin generik pada bucket sensitif.
- Ada risiko perubahan hak akses menyebabkan fungsi otomatis/trigger berhenti jika semua pemanggilan `is_admin()` diganti tanpa pemetaan.
- RLS bisa memiliki beberapa policy yang digabung dengan OR; penambahan policy izin baru tidak otomatis memperketat policy Admin lama. Policy lama yang memberi akses luas harus diperbarui atau dihapus dengan hati-hati dalam migrasi yang sama.
- Fungsi `SECURITY DEFINER` dan hak EXECUTE perlu diaudit agar tidak menjadi jalur bypass.
- Migration 48 `admin_access_foundation` sudah diterapkan di Staging: membuat `private.admin_accounts`, `private.admin_permissions`, dan fungsi pembaca izin saat ini.
- Akun `yukusocial@gmail.com` pada Staging tercatat sebagai `super_admin`; role, status akun, dan verifikasi usia pada `public.users` tidak diubah.
- Tes Staging lulus: Super Admin mendapat empat izin; Admin uji dengan satu izin hanya mendapat menu tersebut; pengguna biasa ditolak; tabel internal tidak dapat dibaca langsung oleh `authenticated`/`anon`.
- Data Admin uji sementara di-rollback; Staging kembali hanya memiliki satu akun Admin dan nol baris izin Admin biasa.
- `public.is_admin()`, kebijakan RLS lama, RPC lama, Storage, dan halaman Admin belum diubah. Karena itu, izin menu belum diberlakukan ke seluruh sistem.
- Production tidak disentuh.

## Implementasi aktual Staging — 21 November 2026

Migrasi 49–61 sekarang menerapkan izin per menu di database, bukan hanya di tampilan. Policy generik Admin yang sebelumnya memperbolehkan akses luas telah diganti dengan izin Talent, Booking, Finance, Support, atau Super Admin sesuai tabel.

Perlindungan khusus:
- Booking Admin membaca daftar operasional melalui RPC kolom-minimal; tidak menerima nilai transaksi, fee, atau pembagian Talent.
- Data `users` dibatasi untuk diri sendiri dan Super Admin; data minimum pengguna disediakan melalui RPC sesuai izin.
- `user_identities` dan bucket KTP memisahkan Customer (Support) dari Talent (Talent).
- Bukti QRIS hanya Finance; branding, hero, poster hanya Super Admin.
- RPC payout, refund, QRIS, laporan, kurasi Talent, dan overview memeriksa izin di dalam fungsi.
- Pengelolaan akun Admin memakai RPC Super Admin; provisioning akun baru hanya dapat dipanggil service role dari Edge Function yang memverifikasi JWT dan Super Admin.
- Tabel private admin tidak memiliki policy akses langsung; data hanya dibaca/diubah melalui fungsi terotorisasi.

Uji Staging mencakup batas izin Talent/Finance/Support/Booking, KTP Storage, RPC minimal booking, penonaktifan akun, dan fungsi pengelolaan Admin. Pengujian akun sementara selalu diakhiri rollback.

Edge Function `admin-management` aktif di Staging; panel UI Pengaturan Admin ada di branch `feature/admin-simple-management`. Belum ada undangan nyata yang dikirim. Production belum diubah, belum ada merge atau deployment Production, dan Xendit tidak disentuh. Build frontend belum terkonfirmasi oleh CI.
