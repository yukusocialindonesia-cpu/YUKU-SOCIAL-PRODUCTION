# Status Fitur YUKU

**Tanggal baseline dokumentasi: 21 November 2026.** Ini adalah snapshot dari kode repository dan hasil pemeriksaan Production yang tersedia pada tanggal tersebut. Bukan jaminan semua alur telah diuji end-to-end.

| Area | Yang terlihat/terverifikasi | Batas yang harus dipahami |
|---|---|---|
| Aplikasi web | React 19, TypeScript, Vite 8; route utama ada di `src/App.tsx` | Build sukses tidak membuktikan semua halaman berfungsi di browser |
| Auth | Supabase Auth dan AuthContext digunakan oleh aplikasi | Semua role dan skenario sesi tetap perlu diuji dengan akun yang sesuai |
| Marketplace Talent | Katalog, detail Talent, kategori, layanan, dan profil ada di kode | Visibilitas, persetujuan, dan ketersediaan dikendalikan database; jangan hanya mengandalkan UI |
| Booking | Frontend memanggil RPC database untuk membuat dan mengelola booking | Checkout frontend default OFF; jangan menganggap pembayaran otomatis aktif |
| Pembatalan/refund | Ada RPC dan UI yang mencatat kebijakan serta permintaan refund | Pencatatan refund bukan transfer uang; refund provider/bank tetap memerlukan proses operasional |
| Payout/escrow | Ada fondasi ledger, validasi, dan alur payout manual pada kode/migration | Jangan menganggap payout otomatis atau scheduler aktif tanpa verifikasi database dan layanan terjadwal |
| Komunitas | Production memiliki tabel `community_posts`, `community_comments`, `community_likes`, `community_reports`; migrasi komunitas diterapkan 21 Nov 2026 | Pengujian visual lintas perangkat dan seluruh role masih harus dilakukan terpisah |
| Affiliate | Panel Admin tersedia; Production terakhir diverifikasi 20 Nov 2026: `commission_percent=10.00`, `is_enabled=true` | Jangan mengubah komisi/ledger secara langsung; formula dan dampak harus ditelusuri |
| Admin | Panel Admin utama dan panel khusus tersedia; akses berbasis izin | Role UI tidak menggantikan RLS dan validasi server |
| Notifikasi | Kode notifikasi dan Web Push ada | Status konfigurasi provider, permission browser, dan pengiriman aktual harus diuji |
| Payment provider | Kode memiliki komponen pembayaran Xendit dan QRIS | Keberadaan komponen bukan bukti kredensial, webhook, dan provider live sudah aktif. Jangan mengubah Xendit tanpa persetujuan |
| Deployment | Repository digunakan untuk Production Cloudflare Workers | Status deployment terbaru harus diperiksa dari event/log Cloudflare; status GitHub build saja tidak cukup |

## Perbaikan akses publik yang diverifikasi 21 November 2026

- Kategori aktivitas: role anon dan authenticated dapat membaca kategori aktif; akses admin tetap memakai pemeriksaan izin.
- Fungsi helper RLS `public.is_super_admin()` dan `public.has_admin_permission(text)` diberi EXECUTE untuk anon agar policy baca publik yang memanggil helper dapat dievaluasi. Dalam pengujian sebagai anon, kedua helper mengembalikan false; tidak memberi hak admin.
- Tabel publik yang diuji dengan role anon: `hero_slides` (4), `promotions` (2), `talent_profiles` (3), `activity_categories` (6).
- Pengguna kemudian menguji login Admin, logout, dan halaman depan; melaporkan kondisi aman.

Perbaikan tersebut tidak mengubah kebijakan tulis Admin dan tidak membuktikan semua policy di seluruh tabel sudah diaudit.

## Komunitas Production — checkpoint 21 November 2026

Migration yang tercatat diterapkan:
- `20261121105125` — community MVP
- `20261121105216` — helper moderasi privat
- `20261121105232` — indeks foreign key komunitas

PR komunitas dan pemeriksaan build terkait telah digabung/berhasil pada checkpoint tersebut. Ini bukan pengganti uji manual dengan akun Customer, Talent, dan Admin.

## Yang belum boleh diklaim selesai

- Payment gateway, webhook, refund provider, dan payout otomatis end-to-end.
- Visual QA seluruh halaman pada ukuran mobile dan desktop.
- Pengujian seluruh kombinasi role/RLS pada semua tabel.
- Status scheduler/cron escrow saat ini tanpa pemeriksaan database/cron.
- Status seluruh migration hanya dari nama file; gunakan migration history aktual.
- Status deployment Production hanya dari hasil GitHub Actions.

Perbarui dokumen ini setiap kali ada perubahan fitur besar atau verifikasi Production baru. Cantumkan bukti dan tanggalnya.


## Xendit retirement update — 27 Nov 2026
Xendit is retired from new YUKU checkout. New payment-route claims and server settlement are limited to manual QRIS and bank transfer. Historical provider enum values and booking/payment records remain readable for compatibility. Legacy pending bookings must be handled through YUKU Support; old payment links must not be reused. The guarded migration `20261127190000_retire_xendit_booking_checkout.sql` is prepared in the canonical branch but has not been applied. Staging replay, payment regression tests, operational secret/callback retirement, and explicit release approval remain required. No Production state was changed.