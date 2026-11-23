import React from 'react';
import { ShieldCheck, Ban, Lock, AlertCircle, FileCheck, PhoneCall } from 'lucide-react';

export const SafetySection: React.FC = () => {
  return (
    <section className="py-4 md:py-20 bg-[#17082A] text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mb-2 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-900/60 border border-purple-700/60 rounded-full text-purple-300 text-xs font-semibold mb-2 md:mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Protokol Keamanan & Integritas Komunitas</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-1.5 md:mb-4">
            Keamanan, Privasi & Batasan Etika yang Tegas
          </h2>
          <p className="text-purple-200/80 text-xs sm:text-base leading-relaxed">
            YUKU menggabungkan verifikasi identitas, aturan layanan, dan fitur pelaporan untuk membantu menjaga pengalaman sosial yang bertanggung jawab.
          </p>
        </div>

        {/* 3 Pillar Cards */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-6 mb-4 md:mb-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Card 1: Anti-Dating & Anti-Sexual Services */}
          <div className="snap-start shrink-0 w-[82vw] sm:w-[60vw] md:w-auto p-3 md:p-6 rounded-[22px] bg-white/[0.07] border border-white/15 backdrop-blur-xl shadow-[0_10px_26px_rgba(0,0,0,0.14)] ring-1 ring-white/5 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-3 md:mb-4 ring-1 ring-white/10">
                <Ban className="w-6 h-6" />
              </div>
              <h3 className="text-base md:text-base md:text-lg font-bold text-white mb-1.5 md:mb-2">
                Layanan Pertemanan Non-Dating
              </h3>
              <p className="text-xs md:text-xs text-purple-200/80 leading-relaxed mb-2 md:mb-4">
                YUKU bukan layanan kencan atau seksual. Permintaan bernuansa seksual, pelecehan, dan aktivitas yang melanggar hukum dilarang. Pelanggaran dapat ditindak sesuai kebijakan komunitas, termasuk pembatasan atau pemblokiran akun.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-pink-300 flex items-center gap-1.5 pt-3 border-t border-purple-900/60">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Aturan komunitas berlaku</span>
            </div>
          </div>

          {/* Card 2: 18+ & ID Verification */}
          <div className="snap-start shrink-0 w-[82vw] sm:w-[60vw] md:w-auto p-3 md:p-6 rounded-[22px] bg-white/[0.07] border border-white/15 backdrop-blur-xl shadow-[0_10px_26px_rgba(0,0,0,0.14)] ring-1 ring-white/5 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 md:mb-4 ring-1 ring-white/10">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-1.5 md:mb-2">
                Verifikasi Identitas & Usia 18+
              </h3>
              <p className="text-xs md:text-xs text-purple-200/80 leading-relaxed mb-2 md:mb-4">
                Customer wajib menyelesaikan verifikasi e-KTP dan usia sebelum dapat melakukan booking. Talent yang tampil juga harus lolos verifikasi identitas, usia, dan persetujuan YUKU.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 pt-3 border-t border-purple-900/60">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Enkripsi data saat tersimpan & dikirim</span>
            </div>
          </div>

          {/* Card 3: Public Spaces Only */}
          <div className="snap-start shrink-0 w-[82vw] sm:w-[60vw] md:w-auto p-3 md:p-6 rounded-[22px] bg-white/[0.07] border border-white/15 backdrop-blur-xl shadow-[0_10px_26px_rgba(0,0,0,0.14)] ring-1 ring-white/5 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 md:mb-4 ring-1 ring-white/10">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-1.5 md:mb-2">
                Pertemuan Offline di Ruang Publik
              </h3>
              <p className="text-xs md:text-xs text-purple-200/80 leading-relaxed mb-2 md:mb-4">
                Untuk aktivitas offline, pilih tempat umum yang ramai seperti kafe, restoran, mall, atau gedung pertemuan. Hindari pertemuan di ruang privat dan laporkan kendala melalui riwayat booking.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 pt-3 border-t border-purple-900/60">
              <PhoneCall className="w-4 h-4 shrink-0" />
              <span>Fitur pelaporan tersedia di riwayat booking</span>
            </div>
          </div>
        </div>
        <p className="md:hidden text-[11px] text-purple-300/80 text-center mt-1">
          Geser kartu ke samping untuk melihat semua aturan keamanan.
        </p>
      </div>
    </section>
  );
};
