# YUKU — Real Friends. Real Moments.

YUKU adalah platform sosial yang menggabungkan **marketplace layanan pertemanan**, **komunitas**, dan **aktivitas sosial**. Layanan dirancang untuk pengalaman online maupun offline.

Dokumentasi ini membedakan implementasi kode, keadaan database yang pernah diverifikasi, dan fitur yang belum diuji end-to-end. Jangan menganggap UI atau migration file sebagai bukti bahwa seluruh proses bisnis sudah aktif.

## Mulai memahami proyek

**Untuk AI (Claude, ChatGPT, Copilot, Codex) dan developer, baca berurutan:**

1. [AGENTS.md](./AGENTS.md) — aturan kerja wajib untuk AI/developer.
2. [CLAUDE.md](./CLAUDE.md) — instruksi singkat untuk Claude.
3. [Panduan proyek](./docs/AI_PROJECT_GUIDE.md) — arsitektur, route, lokasi kode, dan alur fitur.
4. [Status fitur](./docs/FEATURE_STATUS.md) — hal yang sudah diverifikasi dan batas yang belum diuji.
5. [Keamanan Production](./docs/PRODUCTION_SAFETY.md) — tindakan yang memerlukan persetujuan dan prosedur aman.
6. [Panduan migration Supabase](./supabase/migrations/README.md) — cara memeriksa dan menerapkan perubahan database.

## Gambaran produk

- **Marketplace:** penemuan profil Talent, kategori aktivitas, dan layanan.
- **Booking:** fondasi pemesanan, status booking, serta pencatatan transaksi.
- **Komunitas:** posting, komentar, suka, laporan, dan moderasi Admin.
- **Affiliate:** pengaturan persentase komisi dan status program melalui panel Admin.
- **Administrasi:** pengelolaan akses Admin berbasis izin dan moderasi konten.

## Teknologi

- React 19 + TypeScript
- Vite 8
- Supabase: Auth, PostgreSQL, Storage, Realtime, dan fungsi database
- Tailwind CSS 4
- Cloudflare Workers untuk layanan Production (verifikasi deployment dilakukan terpisah)

Repository saat ini adalah aplikasi React + Vite. Migrasi ke Next.js belum dilakukan.

## Menjalankan proyek secara lokal

Persyaratan: Node.js versi yang kompatibel dengan Vite 8.

1. Install dependensi: `npm install`
2. Salin `.env.example` menjadi `.env.local`.
3. Isi variabel Supabase dengan project pengembangan yang memang diizinkan.
4. Jalankan server lokal: `npm run dev`
5. Periksa TypeScript: `npm run lint`
6. Buat build: `npm run build`

Script `lint` saat ini menjalankan TypeScript compiler dengan `--noEmit`, bukan ESLint.

Jangan menaruh `service_role key`, secret provider, atau kredensial privat di variabel frontend. Gunakan hanya URL dan publishable/anon key yang memang ditujukan untuk browser.

## Environment

Lihat `.env.example`.

| Variabel | Keterangan |
|---|---|
| `VITE_SUPABASE_URL` | URL proyek Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key untuk aplikasi browser (client juga mendukung nama publishable key) |
| `VITE_PAYMENT_CHECKOUT_ENABLED` | Sakelar checkout sisi frontend; default `false` |
| `VITE_WEB_PUSH_PUBLIC_KEY` | Public VAPID key; private key harus disimpan sebagai secret server |

Jangan mengaktifkan checkout hanya dengan mengganti flag frontend. Alur pembayaran harus memiliki konfigurasi server, verifikasi webhook, dan pengujian end-to-end yang sesuai.

## Database dan migration Supabase

- Migration berada di `supabase/migrations/`.
- Migration history database aktual adalah sumber kebenaran untuk mengetahui migration yang sudah diterapkan.
- File SQL di repository tidak otomatis berarti sudah dijalankan pada database.
- Jangan menjalankan ulang SQL secara manual atau menerapkan migration lama ke Production tanpa memeriksa riwayat migration, skema, dan kondisi objek database.
- File `supabase/FULL_MIGRATION_V20.sql` adalah file pensiun/peringatan, **bukan** skrip instalasi database. Jangan dieksekusi.

Lihat [panduan migration](./supabase/migrations/README.md) sebelum menyentuh database.

## Status dan batasan penting

- **Komunitas:** tabel komunitas dan migration MVP telah diterapkan ke Production pada 21 November 2026. Lihat [status fitur](./docs/FEATURE_STATUS.md).
- **Affiliate:** panel Admin tersedia. Nilai Production terakhir diverifikasi pada 20 November 2026 adalah komisi 10% dan program aktif.
- **Booking dan keuangan:** fondasi booking, ledger, pembatalan, dan payout tersedia pada kode/database. Checkout frontend default nonaktif. Jangan menganggap pembayaran otomatis, refund provider, atau payout otomatis sudah terhubung dan diuji.
- **Payment provider:** keberadaan komponen Xendit/QRIS di kode bukan bukti konfigurasi live, webhook, dan proses transfer telah terverifikasi. Jangan mengubah provider tanpa persetujuan eksplisit.
- **Production:** build CI sukses bukan bukti deployment, tampilan, atau semua alur bisnis sudah benar.

## Prinsip pengembangan

**Utamakan keamanan data, kestabilan Production, biaya operasional efisien, dan pengalaman pengguna.** Periksa implementasi sebelum mengubah, kerjakan satu ruang lingkup kecil per branch, jalankan test yang relevan, tinjau diff, dan laporkan hal yang belum diverifikasi.

Jangan mengubah database, RLS, secrets, deployment, data keuangan, atau payment provider tanpa persetujuan eksplisit. Baca [Keamanan Production](./docs/PRODUCTION_SAFETY.md).


## Xendit retirement update — 27 Nov 2026
Xendit is retired from new YUKU checkout. New payment-route claims and server settlement are limited to manual QRIS and bank transfer. Historical provider enum values and booking/payment records remain readable for compatibility. Legacy pending bookings must be handled through YUKU Support; old payment links must not be reused. The guarded migration `20261127190000_retire_xendit_booking_checkout.sql` is prepared in the canonical branch but has not been applied. Staging replay, payment regression tests, operational secret/callback retirement, and explicit release approval remain required. No Production state was changed.