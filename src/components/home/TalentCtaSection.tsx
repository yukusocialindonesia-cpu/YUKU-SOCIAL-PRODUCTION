import React from 'react';
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, Sparkles, MapPin, CalendarCheck } from 'lucide-react';

interface TalentCtaSectionProps {
  onExploreClick: () => void;
  onRegisterCustomerClick: () => void;
  onRegisterClick: () => void;
}

export const TalentCtaSection: React.FC<TalentCtaSectionProps> = ({
  onExploreClick,
  onRegisterCustomerClick,
  onRegisterClick,
}) => {
  return (
    <section className="py-5 md:py-12 bg-[#24105F] text-white relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-10 items-center">
          {/* Left Content: Customer-First */}
          <div className="lg:col-span-7">
            <span className="text-xs font-bold text-[#D9CCFF] tracking-wider uppercase mb-2 block">
              Mulai Pengalaman Sosial Baru
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-1.5 md:mb-4">
              Cari Teman Ngopi, Nonton, atau Partner Acara di Kotamu
            </h2>
            <p className="text-[13px] sm:text-base text-[#E8E0FA] leading-relaxed mb-2 md:mb-5">
              Tidak perlu datang sendirian ke kafe baru, konser, atau kondangan. Pilih Talent terverifikasi sesuai hobi dan jadwalmu, lalu pesan dengan sistem pembayaran yang aman.
            </p>

            {/* Customer Feature Highlights */}
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:gap-4 mb-3 sm:mb-8">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold text-xs sm:text-sm leading-tight">
                    Profil Terkurasi & Terverifikasi
                  </strong>
                  <span className="text-[#D9CCFF] text-xs sm:text-xs leading-snug">
                    Semua Talent melalui verifikasi identitas 18+ dan standar etika komunikasi.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold text-[11px] sm:text-sm leading-tight">
                    Bebas Pilih Lokasi Publik
                  </strong>
                  <span className="text-[#D9CCFF] text-[11px] sm:text-xs leading-snug">
                    Bertemu nyaman di kafe, mall, bioskop, atau pilih sesi obrolan online.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold text-[11px] sm:text-sm leading-tight">
                    Tarif Transparan per Jam
                  </strong>
                  <span className="text-[#D9CCFF] text-[11px] sm:text-xs leading-snug">
                    Lihat tarif per jam langsung di profil sebelum mengajukan jadwal booking.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold text-[11px] sm:text-sm leading-tight">
                    Pembayaran Terlindungi
                  </strong>
                  <span className="text-[#D9CCFF] text-[11px] sm:text-xs leading-snug">
                    Dana booking diamankan melalui sistem YUKU dan diteruskan setelah sesi selesai dikonfirmasi.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mt-3 sm:mt-0">
              <button
                onClick={onExploreClick}
                className="min-h-11 px-6 py-3 md:px-7 md:py-3.5 text-sm font-bold text-white bg-gradient-to-r from-[#741CFF] to-[#5F13D6] hover:from-[#5F13D6] hover:to-[#4B0FB0] rounded-xl shadow-[0_8px_22px_rgba(116,28,255,0.22)] ring-1 ring-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Jelajahi Talent Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onRegisterCustomerClick}
                className="min-h-11 px-5 py-3 md:px-6 md:py-3.5 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl shadow-[0_5px_16px_rgba(0,0,0,0.12)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Daftar Akun Customer</span>
              </button>
            </div>
          </div>

          {/* Right Visual Card: Customer Quick Steps + Subtle Talent Link */}
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            <div className="hidden lg:block p-7 rounded-[30px] bg-white/[0.10] backdrop-blur-xl border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.24)] ring-1 ring-white/10 text-white">
              <div className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-[#D9CCFF] mb-5">
                Langkah Mulai untuk Customer
              </div>

              <div className="space-y-3.5 text-xs text-purple-100">
                <div className="flex items-start gap-3 pb-3 border-b border-white/10">
                  <Sparkles className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                  <span>1. Daftar akun Customer dan lengkapi verifikasi e-KTP 18+.</span>
                </div>
                <div className="flex items-start gap-3 pb-3 border-b border-white/10">
                  <MapPin className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                  <span>2. Pilih aktivitas, kota, dan Talent yang cocok dengan minatmu.</span>
                </div>
                <div className="flex items-start gap-3 pb-3 border-b border-white/10">
                  <CalendarCheck className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                  <span>3. Tentukan jam pertemuan di ruang publik atau sesi online.</span>
                </div>
                <div className="flex items-start gap-3 pt-1">
                  <ShieldCheck className="w-4 h-4 text-[#D9CCFF] shrink-0 mt-0.5" />
                  <span>4. Nikmati momen pertemanan positif dengan perlindungan tim YUKU.</span>
                </div>
              </div>
            </div>

            {/* Secondary subtle Talent invitation */}
            <div className="p-3.5 sm:p-4 rounded-[22px] bg-gradient-to-r from-white/[0.11] to-white/[0.06] backdrop-blur-xl border border-white/20 shadow-[0_10px_26px_rgba(0,0,0,0.16)] flex items-center justify-between gap-3">
              <div className="text-[13px]">
                <span className="font-bold text-white block">Ingin bergabung menjadi Talent?</span>
                <span className="text-purple-200/80 text-xs">
                  Atur jadwal sendiri dan temani aktivitas sosial positif.
                </span>
              </div>
              <button
                onClick={onRegisterClick}
                className="shrink-0 min-h-11 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-xs font-bold text-[#D9CCFF] shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Daftar Talent →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

