# Instruksi Claude untuk YUKU

Sebelum mengerjakan repository ini, baca `AGENTS.md` terlebih dahulu. Dokumen tersebut adalah aturan kerja utama untuk semua AI dan developer.

Lalu baca sesuai kebutuhan:
- `docs/AI_PROJECT_GUIDE.md` — arsitektur, route, dan lokasi kode.
- `docs/FEATURE_STATUS.md` — status fitur dan batas verifikasi.
- `docs/PRODUCTION_SAFETY.md` — aturan aman untuk Production dan database.
- `supabase/migrations/README.md` — cara memahami dan menangani migration.

Jangan menganggap dokumentasi lebih baru daripada kode atau database. Jika ada perbedaan, periksa sumber aktual dan laporkan perbedaannya. Jangan mengubah Production, data, RLS, payment provider, atau Xendit tanpa persetujuan eksplisit.

Setiap selesai bekerja, laporkan:
1. Apa yang diperiksa dan diubah.
2. File yang berubah.
3. Perintah/test yang benar-benar dijalankan beserta hasilnya.
4. Hal yang belum diverifikasi.
5. Apakah ada risiko terhadap Production.
