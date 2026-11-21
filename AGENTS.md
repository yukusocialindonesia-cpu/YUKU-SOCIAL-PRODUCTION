# Panduan AI dan Developer YUKU

Baca dokumen ini sebelum mengubah kode. Untuk gambaran sistem, baca `docs/AI_PROJECT_GUIDE.md`; untuk status fitur, baca `docs/FEATURE_STATUS.md`; untuk batasan Production, baca `docs/PRODUCTION_SAFETY.md`.

## Aturan wajib

1. **Periksa sebelum mengubah.** Baca implementasi, tipe, pemanggil, migration terkait, dan riwayat perubahan. Jangan membuat ulang fitur yang sudah ada.
2. **Jangan menebak status.** Bedakan kode yang ada, database yang sudah diverifikasi, fitur yang diuji, dan fitur yang baru berupa fondasi. Tandai hal yang belum diketahui sebagai BELUM DIVERIFIKASI.
3. **Lindungi Production.** Jangan mengubah database, secrets, environment, konfigurasi deploy, domain, payment provider, Xendit, atau data pengguna tanpa persetujuan eksplisit.
4. **Jangan melewati keamanan.** Jangan menghapus/menonaktifkan RLS, memperluas GRANT, membuka fungsi SECURITY DEFINER, atau menurunkan pemeriksaan role hanya untuk menghilangkan error.
5. **Jangan pernah menaruh secret di frontend.** Tidak boleh ada service_role key, secret provider, private VAPID key, token, atau kredensial dalam kode browser, log, dokumentasi, atau commit.
6. **Perubahan database harus bermigrasi.** Periksa skema dan migration history terlebih dahulu. Buat migration baru yang kecil dan jelas; jangan mengedit migration lama yang sudah diterapkan. Jangan menjalankan SQL ke Production tanpa izin eksplisit.
7. **Keuangan adalah area sensitif.** Booking, pembayaran, komisi, affiliate ledger, escrow, refund, payout, dan saldo tidak boleh diubah tanpa analisis dampak dan persetujuan.
8. **Pertahankan desain.** Gunakan pola UI dan tema yang sudah ada. Periksa versi mobile dan desktop bila melakukan perubahan tampilan.
9. **Uji hasil.** Jalankan `npm run lint` dan `npm run build`, ditambah test yang relevan. Build sukses bukan bukti alur bisnis, database, atau deployment sudah benar.
10. **Jelaskan dengan jujur.** Laporkan file yang berubah, pemeriksaan yang benar-benar dijalankan, hasilnya, hal yang belum diuji, dan risiko yang tersisa.

## Cara bekerja

- Kerjakan satu ruang lingkup kecil per branch/PR.
- Hindari refactor besar saat memperbaiki bug spesifik.
- Jangan mengubah kontrak API, nama kolom, status enum, atau RPC tanpa menelusuri semua pemanggil.
- Jangan menggunakan data Production nyata untuk test yang dapat mengubah data.
- Untuk pemeriksaan database, utamakan query baca-saja. Gunakan transaksi dan rollback untuk test yang membutuhkan perubahan sementara.
- Jika bukti tidak cukup, berhenti dan minta informasi yang diperlukan daripada mengarang.
- Sebelum merge atau deploy, tunjukkan ringkasan perubahan dan hasil pemeriksaan.

## Perintah lokal

```bash
npm install
npm run dev
npm run lint
npm run build
```

Environment lokal harus diisi dengan project Supabase pengembangan yang memang diizinkan. Jangan memakai service_role key di browser.

## Prinsip produk

YUKU adalah platform sosial yang menggabungkan marketplace layanan pertemanan, komunitas, dan aktivitas sosial online maupun offline. Prioritas: keamanan pengguna, kestabilan Production, pengalaman mobile yang baik, dan biaya operasional efisien.
