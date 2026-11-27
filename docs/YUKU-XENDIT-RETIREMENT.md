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

Read-only reconciliation (27 Nov 2026):
- Supabase Production project itself reports `ACTIVE_HEALTHY`; the database is online.
- Supabase's linked Git branch metadata reports `main = MIGRATIONS_FAILED`, while its preview project status reports `ACTIVE_HEALTHY`. This is a migration-sync problem, **not proof that the Production database is down**.
- Production migration ledger contains 129 applied records and currently ends at `20261126124423`.
- Open PR #265 (`chore/reconcile-supabase-migration-history`) renames 22 historical migration files, but explicitly leaves other history without a verified local SQL counterpart.
- The PR #265 branch still has 55 ledger versions without a matching local migration filename, while many newer Professional Services/security migrations are not yet in the Production ledger. The full historical replay path is therefore not yet proven.
- The `main` migration directory has duplicate prefixes `62`, `20261126190000`, and `20261127001000`; PR #265's branch removes these duplicate prefixes, but it does not complete the entire ledger-to-file reconciliation.

Therefore the retirement migration in this PR is intentionally **not ready to apply**. First complete PR #265's historical reconciliation, establish a clean Staging replay, and test the retirement migration after all prerequisites. Do not apply this migration directly to Production.

## Tindakan operasional yang belum dilakukan

- Hapus secrets `XENDIT_SECRET_KEY` dan `XENDIT_CALLBACK_TOKEN` dari konfigurasi hosting/Supabase bila memang ada.
- Nonaktifkan callback URL di Dashboard Xendit.
- Tinjau kontrak/akun Xendit dan pastikan tidak ada invoice atau kewajiban provider yang masih berjalan.
- Terapkan migration hanya setelah Staging bersih, seluruh tes QRIS/transfer lulus, dan persetujuan rilis diberikan.

## Batas perubahan

Perubahan ini disiapkan pada branch terpisah. Tidak ada secrets, konfigurasi hosting, dashboard Xendit, database Production, data pembayaran, atau Edge Function Production yang diubah. PR tidak otomatis berarti integrasi sudah hilang dari Production.


## Xendit retirement update — 27 Nov 2026
New checkout and server-side settlement allow only manual QRIS and bank transfer. Historical provider values/rows remain for read compatibility. Legacy pending Xendit bookings must be handled by YUKU Support; old payment links must not be reused. Migration `20261127190000_retire_xendit_booking_checkout.sql` is staged in source only, not applied. Full migration replay, Staging payment tests, secret/callback retirement, and release approval are still required. No Production change has been made.