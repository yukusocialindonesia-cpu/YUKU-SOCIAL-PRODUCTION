# YUKU — Audit Bentrokan Versi Migration
Tanggal: 27 November 2026
Branch yang diperiksa: `design/beranda-brand-promise-v2`
Metode: inspeksi nama dan isi 17 file SQL yang berada pada 8 kelompok prefix/version ganda. Tidak ada SQL yang dijalankan.

## Ringkasan keputusan

**Jangan jalankan folder migration branch ini secara langsung.** Ada bentrokan version ID, dan dua bentrokan Profesional bukan sekadar masalah penamaan: file-file tersebut mewakili fase implementasi berbeda yang tidak aman dijalankan berurutan tanpa rekonsiliasi isi.

Tidak ada perubahan database, migration history, Staging, atau Production dalam audit ini.

## Temuan kritis — Professional Provider

### 1. `20261127000700_professional_provider_identity_decoupling.sql` vs `20261127004000_create_independent_professional_provider_profiles.sql`

Kedua file membuat `public.professional_provider_profiles`.

- File `00700` adalah implementasi lebih lengkap: memiliki `review_status`, `reviewed_by`, dan `reviewed_at`; memindahkan FK `professional_talent_services.provider_id`; mengganti policy pengajuan; serta mengganti RPC review dan public-visibility guard.
- File `04000` adalah Phase A lama: membuat tabel versi awal tanpa kolom review tersebut, mempertahankan FK lama, dan memberi policy/grant publik tersendiri.
- `CREATE TABLE IF NOT EXISTS` pada `00700` tidak menambahkan kolom yang hilang dari tabel yang sudah dibuat oleh `04000`. Jika Phase A dijalankan lebih dahulu, statement lanjutan `00700` yang memakai kolom review dapat gagal.

**Keputusan:** jangan jalankan keduanya sebagai dua migration terpisah. Perlakukan `00700` sebagai jalur implementasi lengkap yang perlu diuji terhadap baseline aktual. File Phase A `04000` harus ditandai superseded/diarsipkan dari jalur replay setelah seluruh pemanggil dan riwayat branch diverifikasi.

### 2. `20261127005000_allow_professional_only_applications.sql`

File Phase B ini mengganti policy insert/revision aplikasi Profesional. Implementasi `00700` sudah membuat policy pengajuan independen dan menambahkan pemeriksaan akun aktif, verifikasi usia, KTP, profil provider, kategori aktif, serta batasan dokumen.

Policy pada file Phase B tidak memuat seluruh pemeriksaan usia dan KTP tersebut. Menjalankannya setelah `00700` berisiko mengganti policy yang lebih ketat dengan policy yang lebih lemah.

**Keputusan:** jangan jalankan Phase B setelah `00700`. Tandai sebagai superseded setelah regression test membuktikan bahwa seluruh perilaku Phase B sudah tercakup oleh `00700` dan migrasi revision-attestation berikutnya.

### 3. `20261127001200_harden_professional_application_revision_attestation_fields.sql`

Komentarnya secara eksplisit bergantung pada provider profile dari `00700`. File ini harus berada setelah jalur identitas Profesional lengkap, bukan setelah Phase A lama.

## Pemetaan 8 kelompok bentrokan

| Prefix saat ini | File / domain | Keputusan awal |
|---|---|---|
| `62` | Admin audit indexes; scoped admin trigger guards | Jangan rename berdasarkan prefix saja. Cocokkan dengan dua Production version timestamp yang tercatat di dokumen rekonsiliasi dan PR #265. |
| `20261126190000` | Professional Data API grants; payout request hardening | Dua perubahan berbeda. Beri version unik setelah memastikan tabel/fungsi target sudah ada. |
| `20261127000700` | Professional Provider decoupling; legacy Talent public policy removal | Dua perubahan berbeda; urutannya perlu ditetapkan berdasarkan dependency. |
| `20261127001000` | Professional revision attestation; selfie evidence/approval guard; report-note privacy | Perubahan terpisah. Revision attestation wajib setelah Provider decoupling; dua lainnya perlu dipastikan dependensinya sebelum diberi version unik. |
| `20261127002000` | Social Experience taxonomy; Merchant foundation | Domain terpisah. Pastikan keduanya setelah baseline objek yang disentuh; Merchant review harus setelah Merchant foundation. |
| `20261127003000` | Merchant admin review/directory; Talent custom Social Experience services | Domain terpisah. Merchant admin review wajib setelah Merchant foundation. |
| `20261127004000` | Professional Provider Phase A lama; Merchant membership management | Provider Phase A berpotensi superseded oleh `00700`. Merchant membership management bergantung pada tabel Merchant dan review history. |
| `20261127005000` | Professional-only Phase B lama; Merchant offers directory | Phase B berpotensi menurunkan proteksi setelah `00700`. Merchant offers harus setelah fondasi Merchant dan helper/review yang dipakainya. |

## Urutan dependency yang dapat disimpulkan dari isi file

1. Pastikan baseline historis dan migrasi dasar yang menyediakan tabel/function terkait sudah direkonsiliasi.
2. Terapkan jalur Professional Provider lengkap `00700` hanya setelah diuji terhadap schema baseline.
3. Jalankan revision-attestation Profesional setelah jalur `00700`.
4. Jalankan fondasi Merchant sebelum Merchant admin review/directory.
5. Jalankan Merchant membership management setelah fondasi Merchant dan review history yang dipakainya.
6. Jalankan Merchant offers setelah fondasi Merchant dan RPC/helper yang dibutuhkannya.
7. Migration taxonomy dan Talent custom Social Experience harus dipetakan terhadap objek existing; keduanya bukan pengganti migration Merchant atau Provider.

Ini adalah urutan dependency dari source SQL, **bukan** instruksi untuk menjalankan migration atau pengganti hasil dry-run.

## Penghambat rekonsiliasi historis

- PR #265 masih terbuka dan belum merged. PR itu menyelaraskan 22 nama migration historis, tetapi catatannya menyatakan masih ada Production records tanpa pasangan file SQL yang terverifikasi.
- Dokumen rekonsiliasi menyebut Production history 107 records pada pemeriksaan sebelumnya; folder branch yang diperiksa berisi 143 SQL files. Jumlah file tidak dapat disamakan dengan jumlah migration yang harus dijalankan.
- Prefix pendek `62` harus dicocokkan ke version timestamp Production yang tepat; jangan menganggap dua file prefix `62` sebagai dua migration baru.
- Belum ada bukti staging replay dan JWT/RLS test untuk Merchant/Professional.

## Langkah berikutnya yang aman

1. Rekonsiliasi PR #265 dengan baseline branch yang benar; verifikasi nama/version dan isi SQL satu per satu.
2. Susun manifest migration canonical dengan status `applied_exact`, `equivalent_applied`, `branch_only`, `superseded`, atau `unknown`.
3. Keluarkan file superseded dari jalur replay tanpa menghapus audit trail Git.
4. Jalankan dry-run pada project disposable/staging yang ref dan statusnya sudah diverifikasi.
5. Jalankan schema preflight, JWT/RLS matrix, Professional-only flow, dan regression Talent/Merchant.
6. Minta persetujuan eksplisit sebelum tindakan Production.

## Referensi internal

- `supabase/migrations/README.md`
- `docs/YUKU-MIGRATION-HISTORY-RECONCILIATION.md`
- `supabase/ops/merchant_partner_staging_preflight.sql`
- PR #265: https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/265
- PR #287: https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/287


## Follow-up correction record — 27 Nov 2026

The source branches were corrected without touching Supabase: preserve the historical `20261127001000_harden_professional_application_revision_attestation_fields.sql` from `main`; use `01100` for KTP evidence; use `01200` for the new Provider-specific revision policy; and use `00800` for legacy public Talent policy removal. PR #284's exact-service booking migration is `11000`. The remaining `04000` Provider Phase A / Merchant membership collision is unresolved. The old Provider Phase A and Phase B migrations are marked superseded in the canonical manifest, but remain in the PR ancestry; do not replay this stack or merge it as-is.
