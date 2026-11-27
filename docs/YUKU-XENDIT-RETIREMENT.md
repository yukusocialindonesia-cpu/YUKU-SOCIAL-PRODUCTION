# Pensiun Integrasi Xendit YUKU

Tanggal keputusan: 27 November 2026

## Keputusan

Xendit dihapus dari jalur checkout baru YUKU. Metode pembayaran Customer yang dipertahankan adalah QRIS manual dan transfer bank, masing-masing tetap tunduk pada pengaturan aktif, bukti pembayaran, pemeriksaan nominal, dan persetujuan Finance.

## Bukti Production (read-only)

Pada saat keputusan dibuat:
- Tidak ada booking dengan `payment_route = 'xendit'`.
- Tidak ada booking Xendit berstatus `pending_payment`.
- Tidak ada baris pembayaran dengan provider Xendit.
- Tidak ada payout dengan provider Xendit.
- Edge Function Production `create-checkout` dan `xendit-webhook` tidak terdaftar aktif.

## Perubahan kode yang disiapkan

- Menghapus komponen checkout/pemberitahuan Xendit dari riwayat booking; booking lama yang masih memiliki route Xendit akan menampilkan instruksi menghubungi Bantuan YUKU dan tidak menyajikan tautan lama.
- Menghapus sumber Edge Function `create-checkout` dan `xendit-webhook`.
- Menghapus konfigurasi webhook Xendit dari `supabase/config.toml`.
- Menghapus langkah type-check Deno khusus fungsi Xendit.
- Memperbarui checklist rilis dan status fitur agar metode pembayaran manual menjadi jalur yang didukung.
- Menambahkan migration untuk menolak route Xendit pada level constraint dan RPC.

## Kompatibilitas dan batas penghapusan

Nilai enum provider historis dan kolom pembacaan route lama tetap dipertahankan. Nilai tersebut tidak dipakai untuk checkout baru. Penghapusan enum secara fisik tidak dilakukan karena berisiko merusak histori pembayaran, default/fungsi database, atau dependensi lama.

Migration memiliki precondition yang menghentikan eksekusi bila masih ada booking dengan route Xendit. Walaupun agregat Production saat audit bernilai nol, migration belum dijalankan. Urutan dan ledger migration Production/Staging harus direkonsiliasi lebih dahulu.

## Migration readiness blocker

Read-only Supabase inspection (27 Nov 2026):
- The linked Supabase main branch reports status `MIGRATIONS_FAILED`.
- The recorded migration ledger currently ends at version `20261126124423`.
- The repository contains later migration work that has not been reconciled against this ledger.

Therefore the retirement migration in this PR is intentionally **not ready to apply**. First reconcile the full ordered migration history and restore a healthy Staging/Preview migration run. Do not apply this migration directly to Production.

## Tindakan operasional yang belum dilakukan

- Hapus secrets `XENDIT_SECRET_KEY` dan `XENDIT_CALLBACK_TOKEN` dari konfigurasi hosting/Supabase bila memang ada.
- Nonaktifkan callback URL di Dashboard Xendit.
- Tinjau kontrak/akun Xendit dan pastikan tidak ada invoice atau kewajiban provider yang masih berjalan.
- Terapkan migration hanya setelah Staging bersih, seluruh tes QRIS/transfer lulus, dan persetujuan rilis diberikan.

## Batas perubahan

Perubahan ini disiapkan pada branch terpisah. Tidak ada secrets, konfigurasi hosting, dashboard Xendit, database Production, data pembayaran, atau Edge Function Production yang diubah. PR tidak otomatis berarti integrasi sudah hilang dari Production.
