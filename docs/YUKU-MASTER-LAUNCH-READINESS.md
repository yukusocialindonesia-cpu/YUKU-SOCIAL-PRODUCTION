# YUKU — Master Launch Readiness Plan

Tanggal: 26 November 2026  
Branch kerja: `feat/professional-services-categories`  
Pull request: #263 (draft, belum merge)  
Tujuan: menyatukan pekerjaan menjadi satu jalur menuju peluncuran YUKU; bukan menambah audit tanpa penutupan.

## Target produk

YUKU adalah super app sosial yang menggabungkan marketplace, komunitas, dan aktivitas, dengan cakupan nasional. Peluncuran harus menjaga pengalaman mobile-first dan memisahkan dengan jelas listing Social & Companion, Activities & Experiences, Professional & Daily Services, Community, serta Partner Deals.

## Status yang benar saat dokumen dibuat

- Branch memiliki 242 commit di depan `main`, 0 di belakang.
- PR #263 masih open dan draft.
- Source audit dan branch-only changes sudah dilakukan pada transaksi, pembayaran, refund, Admin access, RLS/Storage, notifikasi, discovery/location, komunitas/reputasi, dan layanan profesional.
- Belum ada bukti runtime bahwa keseluruhan migration chain berhasil direplay di Staging.
- Belum ada bukti end-to-end test transaksi dan provider sandbox yang lulus.
- Tidak ada perubahan Production yang dilakukan dalam rangka rencana ini.
- Keberadaan kode atau migration di branch bukan bukti fitur sudah aktif atau siap dipakai.

## Gate peluncuran — urutan wajib

### Gate 0 — Bekukan ruang lingkup dan buat baseline
Status: IN PROGRESS

- [ ] Tetapkan branch ini sebagai satu-satunya jalur integrasi sementara.
- [ ] Inventarisasi seluruh halaman, route, RPC, Edge Function, migration, Storage bucket, feature flag dan external provider.
- [ ] Kelompokkan setiap fitur: implemented, partial, blocked, not implemented, needs runtime verification.
- [ ] Tandai fitur yang tidak boleh ditampilkan atau dipakai sebelum backend siap.
- [ ] Jalankan lint dan production build pada branch; simpan hasil dan commit SHA.
- [ ] Periksa perubahan branch terhadap `main` untuk mendeteksi file backup, artefak sementara, migration duplikat/urutan timestamp, dan perubahan di luar ruang lingkup.

Exit criteria: baseline build/lint tersedia; tidak ada fitur yang diklaim siap hanya berdasarkan keberadaan UI/source.

### Gate 1 — Stabilitas aplikasi dan UX mobile
Status: NOT VERIFIED

- [ ] Uji semua route utama pada viewport HP: Beranda, Jelajah, detail Talent, profil Customer, daftar/masuk, Booking, Chat, Komunitas, layanan profesional, bantuan, dan Admin sesuai role.
- [ ] Pastikan loading, empty, error, offline, expired session, dan permission-denied states punya tampilan yang jelas.
- [ ] Pastikan Beranda ringkas, fokus, tidak terlalu lebar, aktivitas pilihan terlihat dalam satu baris ringkas, dan harga tidak muncul di kartu Jelajah/profil ringkas.
- [ ] Pastikan navigasi mobile, keyboard, modal, form panjang, upload, dan tombol sticky tidak menutupi konten.
- [ ] Uji aksesibilitas dasar: kontras, ukuran tap target, label input, fokus keyboard, dan pesan error.
- [ ] Hapus file backup/halaman duplikat hanya setelah referensi route dan kebutuhan rollback diperiksa.

Exit criteria: build/lint lulus; seluruh alur halaman utama lulus smoke test mobile dan desktop.

### Gate 2 — Identitas, role, privasi, dan keamanan
Status: SOURCE AUDITED; RUNTIME BLOCKED

- [ ] Replay seluruh migration berurutan pada Staging database kosong dan database upgrade yang menyerupai Production.
- [ ] Jalankan negative permission tests untuk anon, Customer, Talent, Admin dengan permission berbeda, Super Admin, dan akun nonaktif.
- [ ] Verifikasi column grants, termasuk kolom internal `admin_notes` pada laporan dan cancellation cases; UI allowlist bukan pengganti database grants.
- [ ] Verifikasi RLS efektif pada Data API, bukan hanya membaca definisi policy.
- [ ] Verifikasi private Storage access, object ownership, signed URL expiry, file size/type/signature, cleanup, dan moderation lifecycle.
- [ ] Verifikasi Realtime private channel authorization, broadcast/presence, serta konfigurasi akses publik.
- [ ] Selesaikan desain dan implementasi alur KTP/selfie agar bukti verifikasi dapat direview dan memiliki retention/cleanup yang jelas.
- [ ] Uji account suspension, Admin permission revocation, session refresh, dan channel disconnect.
- [ ] Pastikan secret, internal notes, provider references, exact GPS, dan metadata privat tidak masuk response publik, log, atau push notification.

Exit criteria: semua akses negatif ditolak dan akses sah berfungsi di Staging; tidak ada P0/P1 security blocker terbuka.

### Gate 3 — Satu siklus transaksi Customer sampai Talent
Status: SOURCE AUDITED; END-TO-END NOT TESTED

- [ ] Uji discovery → detail → booking → payment route → pembayaran → escrow → chat → Talent accept/decline → session → kedua pihak konfirmasi selesai → ledger → payout.
- [ ] Uji customer cancellation, Talent cancellation, dispute, refund, expired booking, dan late/duplicate callback.
- [ ] Uji concurrency: dua Customer memesan slot sama, checkout ganda, callback ganda, callback vs QRIS review, cancellation vs acceptance, payout bersamaan.
- [ ] Uji idempotency dan rekonsiliasi pembayaran, commission, Talent earnings, referral earnings, refunds, reserved payouts, dan paid payouts.
- [ ] Tambahkan durable provider invoice/event receipt dan rekonsiliasi untuk kasus provider berhasil membuat invoice tetapi client gagal menerima respons.
- [ ] Perbaiki ketidaksesuaian notifikasi refund yang langsung dibuat dalam status processed; pastikan idempotent untuk INSERT dan UPDATE.
- [ ] Selesaikan hak akses kolom internal cancellation case dan laporan sebelum Production rollout.
- [ ] Uji QRIS proof upload failure cleanup tanpa membuka DELETE Storage secara luas.
- [ ] Pastikan pesan push tidak mengandung isi chat sensitif dan teks escrow sesuai kebijakan release yang benar.
- [ ] Xendit tetap nonaktif untuk checkout baru sampai Edge Functions, secrets, callback URL, route claim, provider sandbox dan Staging tests lengkap.
- [ ] Manual QRIS harus melewati alur Finance yang teruji; jangan menyamakan upload bukti dengan pembayaran yang sudah diverifikasi.

Exit criteria: satu siklus transaksi berhasil dari awal sampai payout di Staging, termasuk skenario gagal dan rekonsiliasi; Finance menyetujui kebijakan escrow/refund.

### Gate 4 — Penyatuan katalog, booking, dan layanan profesional
Status: PARTIAL; BLOCKED FOR CHECKOUT

- [ ] Satukan discovery tanpa mengubah listing profesional per jam/per sesi/per hari/per proyek menjadi harga per jam palsu.
- [ ] Gunakan satu model booking yang menyimpan snapshot layanan, unit harga, kuantitas, total, fee, share, mode, jadwal, dan syarat penerimaan.
- [ ] Tambahkan RPC idempotent yang mengunci listing/slot, menghitung harga di server, memeriksa eligibility, kapasitas, jadwal dan account status.
- [ ] Lengkapi cancellation, refund, dispute, completion/acceptance, escrow dan payout untuk tiap unit layanan.
- [ ] Buat change request terstruktur dengan persetujuan kedua pihak untuk perubahan lokasi/jadwal.
- [ ] Buat add-on booking untuk tambahan durasi/pekerjaan; jangan mengubah snapshot transaksi awal dan jangan menerima pembayaran tambahan di luar YUKU.
- [ ] Jangan aktifkan checkout layanan profesional sampai seluruh consumer booking, finance, notification, review, cancellation dan dispute memakai kontrak booking yang sama.

Exit criteria: layanan profesional dapat ditemukan dan dibeli melalui kontrak yang sama-sama aman; jika belum, tampilkan sebagai listing/informasi saja tanpa CTA checkout yang menyesatkan.

### Gate 5 — Operasional, merchant, dan dukungan
Status: PARTIAL / CONCEPT ONLY FOR MERCHANT VOUCHERS

- [ ] Verifikasi dashboard Admin berdasarkan role dan least privilege.
- [ ] Uji review Talent, dokumen profesional, laporan, moderasi komunitas, refund, payout, dan audit log.
- [ ] Lengkapi alur Customer Support dan eskalasi insiden.
- [ ] Bangun merchant profile, offer/benefit, syarat minimum booking/spend, kuota, periode berlaku, validasi dan redemption log.
- [ ] Pisahkan pembayaran booking ke YUKU dari pembayaran makanan/minuman ke merchant.
- [ ] Jangan tampilkan Partner Deals/voucher seolah sudah bisa ditukar sebelum seluruh lifecycle merchant tersedia.

Exit criteria: operasi harian dapat dijalankan tanpa akses lintas-role dan setiap transaksi/keputusan sensitif memiliki jejak audit.

### Gate 6 — Persiapan rilis bertahap
Status: NOT STARTED

- [ ] Siapkan Staging yang setara konfigurasi Production dan data uji sintetis.
- [ ] Jalankan regression suite, browser/mobile smoke tests, load checks, backup/restore drill, dan incident rollback rehearsal.
- [ ] Siapkan monitoring error, payment reconciliation, queue/cron health, notification delivery, storage growth, dan support response.
- [ ] Pastikan Terms, Privacy, refund/cancellation policies, consent, provider agreements, dan legal/compliance review selesai.
- [ ] Jalankan pilot terbatas di satu kota/area dengan Talent terverifikasi dan support siap.
- [ ] Perluas kota/provinsi bertahap berdasarkan metrik kualitas, supply aktif, conversion, cancellation, dispute, refund, dan response time.
- [ ] Production migration/deployment hanya setelah persetujuan eksplisit dan rencana rollback disetujui.

Exit criteria: pilot stabil, transaksi direkonsiliasi, support siap, tidak ada blocker kritis, dan ada persetujuan rilis.

## Prioritas eksekusi berikutnya

1. Baseline build + lint + daftar route/feature untuk mengetahui kondisi aplikasi yang benar.
2. Tutup P0/P1 database privilege dan transaksi yang sudah teridentifikasi.
3. Siapkan migration replay serta permission regression suite di Staging.
4. Jalankan transaksi end-to-end manual QRIS dahulu; Xendit menyusul setelah kesiapan provider terbukti.
5. Lanjutkan UX mobile dan integrasi katalog/merchant setelah fondasi transaksi aman.

## Aturan kerja

- Semua perbaikan dilakukan di feature branch.
- Tidak merge, deploy, menjalankan migration ke Production, mengubah feature flag Production, atau memproses pembayaran nyata tanpa persetujuan eksplisit.
- Setiap pekerjaan harus menyertakan file/commit yang berubah, hasil verifikasi, batas verifikasi, dan blocker tersisa.
- Bedakan dengan tegas: source change, static check, build/lint, Staging test, dan Production verification.
- Jangan menambah fitur baru jika ia memperbesar risiko transaksi atau belum punya pemilik alur operasional.

## Definisi “siap launching”

YUKU belum siap launching hanya karena halaman tampil atau build berhasil. Siap launching berarti pengguna bisa menemukan layanan yang benar, memahami harga dan syarat, membuat transaksi yang tervalidasi server, berkomunikasi dengan aman, menyelesaikan layanan, menerima refund/payout yang benar, dan memperoleh bantuan ketika terjadi masalah — semuanya diuji di Staging dan dipantau saat pilot.

## Follow-up launch blocker: account and Admin role lifecycle — 26 November 2026

Gate 2 and Gate 5 remain blocked pending verification of account status and Admin revocation paths.

- Production `account-management` Edge Function version 1 is missing the server-side guard that only allows reactivation from `suspended`; the feature-branch source contains the guard. A direct Super Admin invocation can currently request `pending_verification -> active`.
- The account status endpoint updates the database, Auth ban state, and audit log in separate operations with compensating rollback, not one atomic transaction. Add concurrency and forced-failure tests and a reconciliation mechanism before relying on it for high-volume moderation.
- `account_status_type` includes `banned`, but the current Admin UI/API only supports `active` and `suspended`. Define whether permanent ban is needed and its appeal/retention rules before adding the control.
- KTP review rejection currently lacks consistent durable reviewer ID/time attribution in Production.
- Talent approval RPC Production definition can overwrite `suspended`/`banned` account state; preserve current Talent permission checks and audit logging while restricting activation to `pending_verification`.
- Admin role deactivation and permission changes are database-backed and checked dynamically; verify active-session behavior and stale UI after revocation in Staging.

Exit criteria: Production/branch function parity verified; direct RPC/Edge Function negative tests pass; suspend/reactivate/role-revoke race tests pass; every sensitive decision has an append-only actor/time audit record; no account restriction can be bypassed by a different approval path.
### Follow-up: session revocation and active-account enforcement

- Production database guard is present: `private.is_current_user_active()`, 45 restrictive account-status policies, and 46 account-write guard triggers were found by read-only catalog inspection.
- Admin permission checks are derived from live private Admin registry rows; direct database/RPC calls should stop working at the next authorization check after permission revocation, even if an already-open UI still shows stale navigation.
- `AuthContext` refreshes Admin access on token refresh, user update, explicit role refresh, and browser focus. It globally signs out a user when it next verifies a suspended/banned account.
- Open tabs and Realtime sockets have not been runtime-tested. Immediate disconnect must not be assumed. Add Staging tests for role revocation, account suspension, token refresh, existing chat socket, reconnect and Storage/Data API access.
- Production `account-management` Edge Function version 1 still lacks the feature-branch guard that restricts reactivation to accounts whose current status is `suspended`. This remains a P1 rollout blocker.

Exit criteria: direct API/RPC access is denied after revocation; UI refreshes cleanly; suspended users cannot use Data API, Storage or reconnect private Realtime channels; and session/token behavior is documented from observed Staging results.