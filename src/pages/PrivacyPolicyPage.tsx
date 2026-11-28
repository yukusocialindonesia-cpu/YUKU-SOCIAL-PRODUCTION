import React from 'react';
import { ShieldCheck, Lock, Eye, FileText } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-100 via-[#FAF8FC] to-fuchsia-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 rounded-[2rem] border border-white/80 bg-white/70 p-6 shadow-[0_24px_70px_-35px_rgba(76,29,149,0.35)] backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">
            <Lock className="w-4 h-4" />
            <span>Kerahasiaan & Perlindungan Data Pribadi</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1E0938] tracking-tight mb-2">
            Kebijakan Privasi YUKU
          </h1>
          <p className="text-xs text-slate-500">
            Terakhir Diperbarui: November 2026 · Mengacu pada UU Perlindungan Data Pribadi (UU PDP) Indonesia
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 rounded-[2rem] border border-white/80 bg-white/80 p-6 text-xs leading-relaxed text-slate-700 shadow-[0_28px_75px_-38px_rgba(76,29,149,0.4)] backdrop-blur-xl sm:p-10 sm:text-sm">
          <section className="space-y-3 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white/90 to-violet-50/50 p-4 transition hover:border-violet-200 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              1. Komitmen Privasi YUKU
            </h2>
            <p>
              YUKU berkomitmen menjaga kerahasiaan dan perlindungan data pribadi pengguna sebagai kewajiban operasional utama. Kebijakan ini menjelaskan rencana, kewajiban, dan prinsip pengolahan data pribadi Customer dan Talent pada platform YUKU.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white/90 to-violet-50/50 p-4 transition hover:border-violet-200 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              2. Data yang Diproses
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li>
                <strong>Data Identitas & Usia:</strong> Nama lengkap, tanggal lahir, serta foto e-KTP dan swafoto untuk verifikasi batas usia minimal 18 tahun dan keamanan komunitas.
              </li>
              <li>
                <strong>Data Kontak:</strong> Alamat email dan nomor telepon/WhatsApp aktif.
              </li>
              <li>
                <strong>Data Profil Publik:</strong> Foto profil, deskripsi hobi, minat sosial, dan ketersediaan waktu. (Nomor KTP dan alamat pribadi tidak pernah ditampilkan kepada publik).
              </li>
              <li>
                <strong>Data Transaksi:</strong> Riwayat booking dan nomor rekening tujuan pencairan bagi Talent.
              </li>
            </ul>
          </section>

          <section className="space-y-3 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white/90 to-violet-50/50 p-4 transition hover:border-violet-200 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              3. Penggunaan & Pembatasan Informasi
            </h2>
            <p>
              Data pribadi dirancang semata-mata untuk memfasilitasi operasional layanan marketplace, pencocokan jadwal aktivitas sosial, pemrosesan transaksi yang aman, dan pencegahan tindakan kriminal atau pelanggaran etika.
            </p>
            <p>
              <strong>YUKU tidak pernah menjual, menyewakan, atau memperdagangkan data pribadi pengguna kepada pihak ketiga untuk kepentingan periklanan.</strong>
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white/90 to-violet-50/50 p-4 transition hover:border-violet-200 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              4. Komitmen Pengamanan Data
            </h2>
            <p>
              YUKU menerapkan standar perlindungan data dan pembatasan akses sesuai UU Perlindungan Data Pribadi (UU PDP) Indonesia. Dokumen e-KTP dan swafoto disimpan di penyimpanan privat terisolasi dan hanya dapat ditinjau oleh tim admin yang berwenang untuk keperluan verifikasi.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white/90 to-violet-50/50 p-4 transition hover:border-violet-200 sm:p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              5. Hak Pengguna & Pengajuan Informasi
            </h2>
            <p>
              Anda dapat memperbarui informasi profil, meminta salinan data pribadi, atau mengajukan penutupan akun melalui halaman <a href="/hapus-akun" className="text-purple-700 underline font-semibold">Pengajuan Hapus Akun YUKU</a>. Jika Anda tidak dapat login, hubungi <a href="mailto:yukufriends@gmail.com" className="text-purple-700 underline font-semibold">yukufriends@gmail.com</a> dari email yang terdaftar. Pengajuan penutupan akun akan ditinjau terlebih dahulu; data transaksi, sengketa, keamanan, identitas, dan data lain yang wajib disimpan dapat dipertahankan sesuai kewajiban hukum.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
