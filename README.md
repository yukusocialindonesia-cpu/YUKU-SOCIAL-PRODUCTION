# YUKU — Real Friends. Real Moments.

YUKU adalah platform sosial yang menggabungkan **marketplace layanan pertemanan**, **komunitas**, dan **aktivitas sosial**. Layanan dirancang untuk pengalaman online maupun offline.

> Dokumen ini menjelaskan kondisi proyek berdasarkan kode dan perubahan yang telah diverifikasi. Status setiap fitur dapat berbeda; jangan menganggap seluruh alur bisnis otomatis aktif hanya karena UI atau fondasi database tersedia.

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
- Cloudflare Workers untuk layanan Production

## Menjalankan proyek secara lokal

Persyaratan: Node.js versi yang kompatibel dengan Vite 8.

1. Install dependensi:
   `npm install`
2. Salin `.env.example` menjadi `.env.local`.
3. Isi variabel Supabase sesuai proyek pengembangan yang memang diizinkan.
4. Jalankan server lokal:
   `npm run dev`
5. Buat build:
   `npm run build`
6. Periksa TypeScript:
   `npm run lint`

Jangan menaruh `service_role key`, secret, atau kredensial privat di variabel frontend. Gunakan hanya URL dan publishable/anon key yang memang ditujukan untuk browser.

## Konfigurasi environment

Lihat `.env.example`. Variabel utama:

| Variabel | Keterangan |
|---|---|
| `VITE_SUPABASE_URL` | URL proyek Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key untuk aplikasi browser |
| `VITE_PAYMENT_CHECKOUT_ENABLED` | Sakelar checkout sisi frontend; default `false` |
| `VITE_WEB_PUSH_PUBLIC_KEY` | Public VAPID key untuk Web Push; private key harus disimpan sebagai secret server |

Jangan mengaktifkan checkout hanya dengan mengganti flag frontend. Alur pembayaran harus memiliki konfigurasi server, verifikasi webhook, dan pengujian end-to-end yang sesuai.

## Database dan migrasi Supabase

- Berkas migrasi berada di `supabase/migrations/`.
- Catatan migrasi historis berada di `supabase/migrations/README.md`; sebagian keterangannya berasal dari tahap pengembangan sebelumnya dan perlu dibaca bersama riwayat migrasi aktual.
- Riwayat Production mencakup migrasi fitur marketplace, pengamanan Admin, affiliate, notifikasi, dan komunitas, termasuk perbaikan akses baca publik pada 21 November 2026.
- Jangan menjalankan ulang SQL secara manual atau menerapkan migrasi lama ke Production tanpa memeriksa riwayat migrasi dan kondisi skema terlebih dahulu.
- Untuk perubahan database: periksa skema dan kebijakan RLS, buat migrasi yang terukur, uji pada lingkungan aman bila tersedia, lalu verifikasi hasilnya.

File `supabase/FULL_MIGRATION_V20.sql` adalah file pensiun/peringatan, **bukan** skrip instalasi database. Jangan dieksekusi.

## Status fitur dan batasan penting

### Komunitas
Fondasi komunitas telah diterapkan di Production: posting, komentar, likes, laporan, dan moderasi Admin. Perubahan lanjutan tetap perlu diuji sebelum dirilis.

### Affiliate
Pengaturan affiliate tersedia di panel Admin. Nilai awal yang terakhir diverifikasi di database Production adalah komisi **10%** dan program **aktif**. Perubahan tarif harus dilakukan melalui alur Admin yang tersedia; jangan mengubah tabel atau ledger secara langsung.

### Pembayaran, refund, dan payout
- Checkout frontend secara default nonaktif (`VITE_PAYMENT_CHECKOUT_ENABLED=false`).
- Ketersediaan fondasi booking atau ledger tidak berarti pembayaran otomatis sudah terhubung dan tervalidasi.
- Refund dan payout yang memerlukan transfer dana tetap membutuhkan proses dan verifikasi provider/bank sesuai prosedur operasional.
- Jangan mengaktifkan integrasi pembayaran atau mengubah konfigurasi provider tanpa persetujuan dan pengujian khusus.

## Keamanan dan data Production

- Kebijakan Row Level Security (RLS) Supabase adalah lapisan utama pembatasan akses data.
- Jangan menghapus atau memperlonggar RLS, grant, atau fungsi pemeriksaan Admin untuk mengatasi error tanpa audit dampak akses.
- Perubahan pada booking, saldo, komisi, refund, payout, identitas/KTP, dan konfigurasi provider termasuk perubahan sensitif.
- Jangan pernah memasukkan secret, token, data pribadi pengguna, atau kredensial ke Git.

## Kontribusi dan alur perubahan

1. Periksa implementasi yang sudah ada sebelum mengubah kode.
2. Buat branch khusus untuk satu ruang lingkup perubahan.
3. Jalankan pemeriksaan yang relevan (`npm run lint`, `npm run build`, dan pengujian terkait).
4. Tinjau perubahan dan dampaknya terhadap RLS, data, serta alur keuangan.
5. Gabungkan perubahan setelah pemeriksaan dan persetujuan.
6. Verifikasi deployment Production secara terpisah; build sukses tidak otomatis membuktikan deployment atau tampilan sudah benar.

## Prinsip pengembangan

**Utamakan keamanan data, kestabilan Production, biaya operasional yang efisien, dan pengalaman pengguna.** Hindari perubahan besar sekaligus. Jangan menganggap fitur selesai sebelum diuji pada alur pengguna yang sebenarnya.
