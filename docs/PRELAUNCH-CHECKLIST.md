# Checklist Pra-Launch YUKU 2.0

Status: **belum production-ready**. Centang hanya setelah diverifikasi sendiri.

## A. Kode & build
- [ ] `npm install` (hasilkan `package-lock.json`, lalu commit) lalu `npm run typecheck` dan `npm run build` bersih tanpa error.
- [ ] Tidak ada folder internal di hasil build: `dist/` tidak berisi `assets/aistudio`, `.aistudio`, `.agents`, atau berkas CSV/skema.
- [ ] Hosting memakai fallback SPA (`vercel.json` / `public/_redirects` sudah disediakan). Uji refresh pada `/admin` dan `/talent/<id>`.

## B. Database (staging dulu)
- [ ] Buat proyek Supabase staging KOSONG. Terapkan migrasi `01` s/d `23` berurutan.
- [ ] Jalankan `tests/stage_a`, `stage_b` (perbarui fixture, lihat README migrasi), dan `stage_c`. Semua PASS.
- [ ] Jalankan `ops/post_deploy_checks.sql`. Semua baris PASS.
- [ ] Aktifkan `pg_cron`, terapkan migration 33; konfirmasi job `release-escrow-completed-bookings` dan `expire-stale-bookings` terdaftar di `cron.job`.
- [ ] Buat akun admin HANYA lewat `SELECT public.provision_admin_user('<uuid>')` di SQL Editor.
- [ ] Ulangi urutan yang sama di produksi hanya setelah staging bersih.

## C. Pembayaran manual (QRIS & transfer bank)
- [ ] Pastikan hanya metode pembayaran yang aktif dan telah diverifikasi Finance yang ditampilkan kepada Customer.
- [ ] Uji penguncian satu metode pembayaran per booking, kepemilikan booking, nominal persis, masa berlaku, dan bukti pembayaran privat.
- [ ] Uji persetujuan Finance, penolakan bukti, pengiriman ulang, callback/status ganda, dan settlement idempotent.
- [ ] Xendit telah dipensiunkan dari checkout baru; jangan menambahkan secrets, callback, atau Edge Function Xendit.

## D. Data pribadi & hukum (perlu peninjauan profesional)
- [ ] Kebijakan Privasi/Syarat mencerminkan praktik nyata: NIK dan rekening disimpan sebagai teks di database; foto KTP di bucket privat. Klaim "terenkripsi" sudah dihapus dari UI. Jika ingin enkripsi kolom, rancang dengan Supabase Vault/pgsodium dan uji alur review admin.
- [ ] Tinjauan kepatuhan UU Pelindungan Data Pribadi (retensi, hak hapus data, pemberitahuan insiden).
- [ ] Tinjauan hukum untuk model escrow/split payment dan kebijakan pembatalan Customer (belum diimplementasikan).
- [ ] Ada kontak dukungan nyata (`VITE_SUPPORT_EMAIL`) dan prosedur penanganan laporan/sengketa.

## E. Operasional
- [ ] Backup/PITR Supabase aktif; pemantauan error (mis. Sentry) dan alert.
- [ ] Soft launch tertutup dengan beberapa Talent dan Customer sungguhan sebelum rilis publik.
