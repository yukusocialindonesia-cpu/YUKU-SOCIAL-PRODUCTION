# YUKU — Baseline Repository Review

Tanggal: 26 November 2026  
Branch: `feat/professional-services-categories`  
PR: #263 (draft)

## Ruang lingkup dan batas pemeriksaan

Review dilakukan melalui pembacaan GitHub source dan konfigurasi workflow. Ini bukan local checkout, browser test, Supabase Staging test, atau Production certification. Hasil build/lint hanya boleh dinyatakan setelah GitHub Actions menyelesaikan job.

## Struktur aplikasi yang teridentifikasi

- React 19 + Vite 8 + TypeScript 7.
- Supabase JS client.
- `src/App.tsx` menjadi route dispatcher.
- Beranda dimuat eager; halaman sekunder memakai React lazy/Suspense.
- Route utama meliputi Beranda, Jelajah Talent, detail Talent, layanan profesional, komunitas, pendaftaran Talent, dashboard Talent, booking history, profil Customer, Admin, verifikasi KTP, autentikasi, bantuan, FAQ, syarat dan privasi.
- Layout utama menyediakan Navbar, Footer, Safety Pledge dan Mobile Bottom Navigation.
- Web Push service worker berada di `public/sw.js`.

## Temuan baseline

### B0-01 — CI sebelumnya tidak terpicu untuk feature branch ini

Workflow `.github/workflows/main-build-validation.yml` hanya menjalankan push pada `main` dan branch lain yang bukan feature branch YUKU ini. Pull request validation belum dikonfigurasi. Akibatnya, perubahan pada branch kerja dapat tidak menjalankan pemeriksaan TypeScript/build otomatis.

**Perbaikan branch:** workflow sekarang memicu push pada `feat/professional-services-categories` dan pull request ke `main`, selain workflow_dispatch.

Commit: `8a4429a7345f3365e3cbf499c00961d764d03dad`.

**Validasi:** GitHub Actions run #83 dibuat untuk PR #263. Saat laporan ini disusun, job telah melewati checkout dan setup Node, sedang menginstal locked dependencies; TypeScript check dan production build belum berjalan/selesai. Hasil final wajib diperbarui dari run yang sama.

### B0-02 — Dua migration memakai version prefix `62`

Repository memuat:
- `62_index_admin_audit_actor_foreign_keys.sql`
- `62_scoped_admin_trigger_guard_hardening.sql`

Supabase migration version berasal dari prefix version pada nama file. Dua file dengan version yang sama dapat menyebabkan duplicate-version/replay conflict, bergantung pada migration runner dan history yang ada.

**Status:** release blocker sampai migration history dan riwayat penerapan diverifikasi. Jangan sekadar rename file yang mungkin sudah pernah diterapkan. Rekonsiliasi harus membandingkan migration history target dengan schema aktual; gunakan migration forward baru bila perlu.

### B0-03 — Backup source berada di folder halaman

`src/pages/LoginPage.tsx.bak` ada di repository. Belum ditemukan bukti file tersebut dipakai oleh bundler; tetap perlu pemeriksaan import/reference sebelum penghapusan. Jangan biarkan backup source menjadi bagian artefak aplikasi tanpa alasan.

### B0-04 — Route tidak dikenal kembali ke Beranda

`src/App.tsx` mengarahkan path yang tidak dikenal ke Beranda. Ini mencegah blank screen, tetapi URL salah atau link lama dapat terlihat seolah berhasil membuka halaman Beranda. Pertimbangkan not-found state/404 setelah memastikan kompatibilitas deep-link dan route lama.

### B0-05 — Route parsing ditangani oleh inisialisasi dan listener

Route awal ditentukan dari pathname saat state dibuat, kemudian `parseCurrentLocation` dipanggil lagi di effect dan pada `popstate`. Ini perlu regression test untuk direct deep-link, browser back/forward, query filters, reset password hash, dan admin invite hash. Tidak dinyatakan sebagai bug tanpa runtime test.

## Daftar route untuk smoke test

- [ ] `/` — Beranda
- [ ] `/talent` dan `/talent/:id` — Jelajah/detail
- [ ] `/jasa-profesional`, `/jasa-profesional/:id`, `/daftar-jasa-profesional`
- [ ] `/komunitas`
- [ ] `/daftar-talent`, `/dashboard-talent`
- [ ] `/riwayat-booking`, `/profil-saya`
- [ ] `/admin`, `/admin/jasa-profesional`, `/aktivasi-admin`
- [ ] `/verifikasi-ktp`
- [ ] `/login`, `/register`, `/lupa-sandi`, `/reset-sandi`, `/ganti-sandi`
- [ ] `/cara-kerja`, `/tentang`, `/faq`, `/bantuan`, `/syarat-ketentuan`, `/kebijakan-privasi`

## Hasil CI

- Workflow: YUKU main build validation.
- Steps: `npm ci`, `npm run lint`, `npm run build`.
- Run: #83 (PR #263).
- Status pada saat baseline disusun: dependency installation sedang berjalan; belum ada hasil TypeScript/build.
- Run URL: https://github.com/yukusocialindonesia-cpu/YUKU-id/actions/runs/45797045271

## Langkah lanjutan

1. Tunggu dan catat hasil CI #83; perbaiki semua kegagalan pada branch.
2. Rekonsiliasi duplicate migration version 62 sebelum Staging replay.
3. Periksa referensi file backup dan bersihkan bila aman.
4. Tambah smoke tests route/deep-link dan 404 behavior.
5. Jalankan Staging migration replay dan negative role/permission tests.
6. Lanjutkan transaksi end-to-end setelah baseline frontend hijau.

## Batas keamanan

Tidak ada migration yang dijalankan, tidak ada perubahan Supabase/Staging/Production, tidak ada deployment, tidak ada merge, dan tidak ada transaksi/pembayaran nyata. Branch dan PR tetap terpisah dari Production.
