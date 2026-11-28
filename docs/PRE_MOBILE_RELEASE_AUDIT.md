# Audit Awal Pra-Rilis Mobile YUKU
Tanggal: 28 November 2026
Basis: main @ 40e2dd41574b5facb2af6ff9fcf3fec5f73dc8f8
Status: audit awal, belum menyatakan siap rilis.

## Sudah terbukti
- Fondasi Capacitor Android/iOS tersedia.
- CI pada checkpoint main berhasil membangun Android debug APK dan iOS Simulator app.
- TypeScript dan production web build pada checkpoint main sebelumnya lulus.
- Client Supabase menggunakan environment variables; placeholder memakai domain .invalid bila konfigurasi tidak ada.
- Repository memiliki SQL migrations dan SQL security tests, tetapi keberadaan file tidak membuktikan migration Production sudah diterapkan atau semua tes sudah dijalankan.

## P0 — Penghalang rilis
1. **Push native belum terintegrasi.** Dependency Capacitor Push Notifications ada, tetapi implementasi yang ditemukan adalah Web Push (Service Worker/PushManager/VAPID). Service Worker sengaja tidak didaftarkan pada platform native. Edge Function `yuku-push` yang diperiksa hanya menyimpan subscription endpoint Web Push dengan key p256dh/auth. Belum ada registrasi token APNs/FCM, handler notifikasi native, atau routing saat notifikasi diklik.
2. **Deep link belum selesai diverifikasi.** Router web membaca pathname/history; belum ditemukan listener JS `appUrlOpen` atau bukti konfigurasi Android App Links/iOS Universal Links. Uji link profil, booking, reset password, undangan, dan notifikasi masih wajib.
3. **Build release bertanda tangan belum dibuktikan.** Workflow AAB/IPA membutuhkan secrets signing. Workflow yang diperiksa mengunggah artifact, bukan menerbitkan langsung ke Play Console/App Store Connect. Validitas keystore, certificate, provisioning profile, team, bundle ID, dan akses store belum diverifikasi.
4. **Uji perangkat fisik belum ada buktinya.** Sukses Android debug APK dan iOS Simulator bukan bukti uji perangkat fisik, lifecycle, izin perangkat, keyboard/safe-area, kamera/galeri, jaringan terputus, dan push.

## P1 — Wajib sebelum kandidat rilis
5. Belum terlihat test UI end-to-end (Playwright/Cypress) atau unit-test runner pada script package. TypeScript/build saja tidak menguji alur customer/talent/admin.
6. `docs/FEATURE_STATUS.md` masih ber-baseline 21 November 2026 dan menyatakan banyak alur keuangan, scheduler, RLS, dan deployment belum boleh diklaim selesai tanpa verifikasi.
7. PR #342 untuk entry Community masih memakai biru `#2563EB`, tidak sesuai standar ungu premium terbaru; PR juga tidak mergeable pada pemeriksaan ini. Jangan merge tanpa rebase dan penyesuaian warna.
8. `capacitor.config.ts` dan `public/site.webmanifest` memakai `#FAF8FC`; perlu diselaraskan dengan identitas ungu YUKU saat finalisasi native.

## P2 — Penyempurnaan
9. Android masih menunjukkan versionCode 1 / versionName 1.0; perlu aturan versi/build number untuk rilis.
10. Privacy Policy, izin perangkat, penggunaan data, retensi, dan penghapusan akun perlu dicocokkan dengan perilaku aplikasi native sebenarnya.

## Batas audit
Belum ada perubahan Production, database, secrets, atau deployment. Audit ini belum mengesahkan seluruh halaman, seluruh policy RLS, booking/pembayaran/refund/payout, webhook, scheduler, maupun seluruh migration. Status Production harus dibuktikan dengan pemeriksaan read-only pada environment yang benar.

## Tahap berikut
- Audit semua route dan peran pengguna.
- Audit RPC, schema, storage, RLS, trigger, webhook, dan proses keuangan terhadap migration aktual.
- Buat matriks uji end-to-end non-production.
- Implementasikan push native dan deep link.
- Uji perangkat fisik dan signing release.
- Tutup temuan P0/P1 sebelum kandidat rilis.
