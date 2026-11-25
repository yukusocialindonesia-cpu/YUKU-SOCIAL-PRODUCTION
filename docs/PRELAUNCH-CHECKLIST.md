# Checklist Pra-Launch YUKU 2.0

Status: **belum production-ready**. Centang hanya setelah diverifikasi sendiri.

## A. Kode & build
- [ ] `npm install` (hasilkan `package-lock.json`, lalu commit) lalu `npm run typecheck` dan `npm run build` bersih tanpa error.
- [ ] Tidak ada folder internal di hasil build: `dist/` tidak berisi `assets/aistudio`, `.aistudio`, `.agents`, atau berkas CSV/skema.
- [ ] Hosting memakai fallback SPA (`vercel.json` / `public/_redirects` sudah disediakan). Uji refresh pada `/admin` dan `/talent/<id>`.

## B. Database (staging dulu)
- [ ] Buat proyek Supabase staging KOSONG. Terapkan migration sesuai urutan dan prosedur terbaru di `supabase/migrations/README.md`; jangan mengandalkan rentang nomor historis atau `FULL_MIGRATION_V20.sql`.
- [ ] Cocokkan migration history staging dengan file migration dan skema aktual sebelum menjalankan test.
- [ ] Jalankan test Stage A, B, C, dan skenario payment-route Stage D setelah fixture disiapkan. Catatan: `stage_d_payment_route_lock_tests.sql` saat ini adalah spesifikasi komentar, bukan test SQL executable; jangan tandai lulus sebelum test assertions ditulis dan dijalankan.
- [ ] Jalankan `ops/post_deploy_checks.sql`, lalu tinjau WARN/INFO secara manual. Skrip tersebut perlu diperbarui untuk mencakup tabel, fungsi, dan kebijakan migration terbaru.
- [ ] Verifikasi `pg_cron` dan job escrow/expire dari database aktual; jangan menganggap nomor migration 33 selalu menjadi versi aktif.
- [ ] Buat akun admin HANYA lewat `SELECT public.provision_admin_user('<uuid>')` di SQL Editor.
- [ ] Ulangi urutan yang sama di produksi hanya setelah staging bersih.

## C. Pembayaran (QRIS / transfer bank manual; Xendit ditahan untuk checkout baru)
- [ ] Pastikan migration payment-route, QRIS, dan manual bank transfer benar-benar diterapkan pada staging; verifikasi function definition dan storage policies dari database aktual.
- [ ] Uji QRIS end-to-end: metode aktif/nonaktif, upload bukti, file tidak valid/terlalu besar, nominal tidak cocok, pengajuan ganda, review Finance approve/reject, dan settlement/ledger hanya sekali.
- [ ] Uji transfer bank end-to-end: snapshot rekening per booking, upload bukti, nominal tidak cocok, referensi transaksi ganda, review Finance approve/reject, file privat/signed URL, dan settlement/ledger hanya sekali.
- [ ] Uji route lock: Xendit ditolak untuk booking baru; metode manual yang tidak aktif ditolak; route yang sudah terkunci tidak dapat diganti; legacy Xendit hanya menyelesaikan transaksi lama yang sudah terkunci.
- [ ] Pastikan booking expired, cancellation, refund, dispute, dan escrow tidak dapat disalahgunakan untuk mengesahkan pembayaran atau membayar dua kali.
- [ ] Xendit: jangan aktifkan `create-checkout`, webhook, atau flag checkout Xendit untuk booking baru sampai ada keputusan produk dan test sandbox terpisah. Jika Xendit akan diaktifkan lagi, buat migration/test yang secara eksplisit mengubah kebijakan route lock terlebih dahulu.
- [ ] Aktifkan flag booking/checkout hanya setelah alur manual, konfigurasi QRIS/rekening, prosedur rekonsiliasi, dan akses Finance diverifikasi pada staging.

## D. Data pribadi & hukum (perlu peninjauan profesional)
- [ ] Kebijakan Privasi/Syarat mencerminkan praktik nyata: NIK dan rekening disimpan sebagai teks di database; foto KTP di bucket privat. Klaim "terenkripsi" sudah dihapus dari UI. Jika ingin enkripsi kolom, rancang dengan Supabase Vault/pgsodium dan uji alur review admin.
- [ ] Tinjauan kepatuhan UU Pelindungan Data Pribadi (retensi, hak hapus data, pemberitahuan insiden).
- [ ] Tinjauan hukum untuk model escrow/split payment dan kebijakan pembatalan Customer (belum diimplementasikan).
- [ ] Ada kontak dukungan nyata (`VITE_SUPPORT_EMAIL`) dan prosedur penanganan laporan/sengketa.

## E. Operasional
- [ ] Backup/PITR Supabase aktif; pemantauan error (mis. Sentry) dan alert.
- [ ] Soft launch tertutup dengan beberapa Talent dan Customer sungguhan sebelum rilis publik.
