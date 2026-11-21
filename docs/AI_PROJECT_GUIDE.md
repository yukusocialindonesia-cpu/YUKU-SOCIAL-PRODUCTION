# Panduan Memahami Proyek YUKU

Dokumen ini menjadi peta awal bagi AI/developer. Selalu cocokkan dengan kode terbaru sebelum membuat perubahan.

## 1. Gambaran produk

YUKU adalah platform sosial yang menggabungkan:
- Marketplace untuk menemukan Talent dan layanan pertemanan.
- Booking aktivitas online maupun offline.
- Komunitas untuk posting, komentar, suka, dan pelaporan.
- Akun Customer, Talent, dan Admin.
- Fitur pendukung seperti notifikasi dan program Affiliate.

Tagline produk di repository: **Real Friends. Real Moments.**

## 2. Teknologi yang terverifikasi dari repository

- React 19
- TypeScript
- Vite 8
- Supabase JavaScript client
- Supabase Auth, PostgreSQL, Storage, dan Realtime sesuai pemakaian kode
- Tailwind CSS 4 melalui plugin Vite
- Cloudflare Workers untuk layanan Production (konfigurasi deployment harus diperiksa terpisah)

Repository saat ini adalah aplikasi React + Vite. Jangan menganggapnya sudah memakai Next.js.

## 3. Cara aplikasi dimulai

- `src/main.tsx`: entry point React; memasang `AuthProvider` dan stylesheet. File ini juga mendaftarkan service worker pada browser HTTPS yang mendukungnya.
- `src/App.tsx`: mengelola path aplikasi, membaca URL, menangani navigasi browser, dan memilih halaman.
- `src/layouts/MainLayout.tsx`: kerangka halaman dengan Navbar, Footer, Safety Pledge Banner, dan Mobile Bottom Navigation.
- `src/contexts/AuthContext.tsx`: sumber state autentikasi yang dipakai komponen melalui `useAuth()`.
- `src/lib/supabase.ts`: membuat Supabase client dari environment. Jika konfigurasi tidak tersedia, client memakai URL domain .invalid agar tidak diam-diam terhubung ke project sungguhan.

## 4. Peta route dan halaman

Route utama ditentukan di `src/types/navigation.ts` dan dirender melalui `src/App.tsx`.

| Route | Halaman |
|---|---|
| `/` | `src/pages/HomePage.tsx` |
| `/talent` | `src/pages/BrowseTalentPage.tsx` |
| `/talent/:id` | `src/pages/TalentDetailPage.tsx` |
| `/komunitas` | `src/pages/CommunityPage.tsx` |
| `/cara-kerja` | `src/pages/HowItWorksPage.tsx` |
| `/daftar-talent` | `src/pages/BecomeTalentPage.tsx` |
| `/dashboard-talent` | `src/pages/TalentDashboardPage.tsx` |
| `/riwayat-booking` | `src/pages/BookingHistoryPage.tsx` |
| `/profil-saya` | `src/pages/CustomerProfilePage.tsx` |
| `/admin` | `src/pages/AdminPage.tsx` |
| `/login`, `/register` | Halaman autentikasi |
| `/verifikasi-ktp` | Verifikasi identitas |
| `/lupa-sandi`, `/reset-sandi`, `/ganti-sandi` | Pemulihan dan penggantian sandi |
| `/tentang`, `/faq`, `/bantuan` | Informasi dan bantuan |
| `/syarat-ketentuan`, `/kebijakan-privasi` | Dokumen kebijakan |

Navigasi adalah implementasi routing internal berbasis History API, bukan React Router. Saat menambah route, periksa tipe `AppRoute`, parsing URL, handler navigasi, dan switch render di `App.tsx`.

## 5. Lokasi kode penting

- `src/pages/`: halaman aplikasi.
- `src/layouts/`: Navbar, footer, dan navigasi.
- `src/components/`: komponen UI; subfolder mengelompokkan fungsi seperti admin, booking, chat, dan common.
- `src/contexts/`: context global, terutama autentikasi.
- `src/lib/`: integrasi layanan eksternal seperti Supabase dan Web Push.
- `src/types/`: tipe aplikasi dan database.
- `src/utils/`: formatter dan helper.
- `supabase/migrations/`: perubahan skema, fungsi, trigger, policy, dan grant.
- `supabase/functions/`: Supabase Edge Functions bila tersedia.
- `supabase/tests/`: test SQL.
- `supabase/ops/`: pemeriksaan operasional pasca-deploy.
- `docs/`: laporan dan catatan implementasi.

## 6. Integrasi Supabase

Supabase client dibuat di `src/lib/supabase.ts`. Environment frontend yang terdokumentasi di `.env.example`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` atau publishable key yang didukung client
- `VITE_PAYMENT_CHECKOUT_ENABLED`
- `VITE_WEB_PUSH_PUBLIC_KEY`

Semua variabel dengan prefix `VITE_` dapat masuk ke bundle browser. Jangan pernah menaruh service_role key atau secret di sana.

Frontend mengakses tabel/RPC melalui Supabase JS. Keamanan data harus ditegakkan di PostgreSQL melalui GRANT, RLS, fungsi, dan trigger. Pemeriksaan role pada UI bukan pengganti otorisasi database.

## 7. Area fitur dan alur penting

### Autentikasi dan role
Gunakan `useAuth()` dari AuthContext untuk state akun. Telusuri AuthContext, Navbar, route, AdminPage, dan kebijakan database sebelum mengubah perilaku login, logout, atau role.

### Marketplace dan Talent
Halaman katalog berada di `BrowseTalentPage.tsx`; detail Talent dan inisiasi booking berada di `TalentDetailPage.tsx`. Validasi booking harus tetap di server/database, bukan hanya validasi frontend.

### Booking dan keuangan
Riwayat booking ada di `BookingHistoryPage.tsx`. Kode memanggil RPC database untuk operasi penting, termasuk `create_booking`, `request_customer_cancellation`, dan `confirm_booking_completion`. Periksa definisi RPC, migration, trigger, dan ledger sebelum mengubah alur. Status booking dan transaksi bukan sekadar state UI.

### Komunitas
Halaman komunitas ada di `CommunityPage.tsx`. Fitur Production yang telah diverifikasi mencakup posting, komentar, like, report, dan moderasi Admin. Tabel terkait: `community_posts`, `community_comments`, `community_likes`, `community_reports`.

### Admin
Panel Admin utama ada di `AdminPage.tsx`; fitur tertentu dipisah menjadi komponen di `src/components/admin/`. Contoh: `AffiliateAdminPanel.tsx` mengubah `affiliate_settings`. Hak akses harus sesuai izin Admin dan RLS.

### Affiliate
Panel pengaturan ada di `src/components/admin/AffiliateAdminPanel.tsx`. Kode menjelaskan komisi Affiliate sebagai persentase dari bagian komisi platform YUKU, bukan persentase dari seluruh harga booking. Nilai aktual dibuat oleh database pada transaksi yang memenuhi syarat. Jangan mengubah formula tanpa menelusuri migration dan ledger.

### Notifikasi dan Web Push
Cari implementasi di `src/components/common/` dan `src/lib/webPush.ts`. Public VAPID key boleh berada di frontend; private VAPID key harus tetap sebagai secret server.

## 8. Perintah pengembangan

```bash
npm install
npm run dev
npm run lint
npm run build
```

Script `lint` saat ini menjalankan TypeScript compiler dengan `--noEmit`; jangan menyebutnya ESLint.

## 9. Cara menelusuri bug

1. Dapatkan pesan error lengkap, route, role akun, dan langkah untuk mengulanginya.
2. Cari komponen yang menampilkan error.
3. Telusuri query/RPC yang dipanggil.
4. Periksa tipe database dan migration pembentuk tabel/fungsi.
5. Periksa GRANT, RLS policy, dan SECURITY DEFINER jika error akses.
6. Bedakan error permission PostgreSQL, error RLS (hasil kosong), konfigurasi, dan jaringan.
7. Buat perubahan sekecil mungkin.
8. Jalankan pemeriksaan lokal/CI dan uji alur terkait.
9. Jangan menyimpulkan Production sudah benar hanya dari build.

## 10. Sumber kebenaran

Jika dokumen dan implementasi tidak cocok:
1. Kode pada branch yang sedang diperiksa menjelaskan perilaku frontend.
2. Migration menjelaskan perubahan skema yang dimaksud, tetapi tidak membuktikan sudah diterapkan.
3. Migration history dan katalog database menjelaskan keadaan database aktual.
4. Test dan log membuktikan hanya skenario yang benar-benar dijalankan.
5. Deployment event/log membuktikan status deployment, bukan kualitas seluruh fitur.

Selalu tulis tanggal dan ruang lingkup verifikasi. Jangan menyalin status historis sebagai status saat ini.
