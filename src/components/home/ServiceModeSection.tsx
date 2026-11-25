import React from 'react';
import { UsersRound, MapPin, Video, MessageCircle, ArrowRight } from 'lucide-react';

interface ServiceModeSectionProps {
  onSelectMode: (mode: 'offline' | 'online') => void;
}

export const ServiceModeSection: React.FC<ServiceModeSectionProps> = ({ onSelectMode }) => {
  return (
    <section className="relative overflow-hidden py-4 sm:py-9 bg-[#F8F7FC] text-[#24105F] border-y border-[#EEEAF5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tampilan ringkas khusus HP */}
        <div className="sm:hidden">
          <div className="mb-2.5">
            <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#741CFF]">PILIH JENIS LAYANAN</span>
            <h2 className="text-base font-extrabold tracking-tight text-[#24105F]">
              Pilih cara beraktivitas
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#625B70]">
              Tentukan pengalaman yang kamu inginkan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectMode('offline')}
              className="yuku-depth-card group flex min-h-[84px] min-w-0 items-center gap-2.5 rounded-2xl border border-[#E8E2F0] bg-white p-3 text-left shadow-[0_4px_14px_rgba(36,16,95,0.07)] transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#741CFF]"
            >
              <span className="yuku-icon-orb flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#741CFF] text-white">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-[#24105F]">Offline</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[#625B70]">
                  Temui Talent secara langsung
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#741CFF] transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('online')}
              className="yuku-depth-card group flex min-h-[84px] min-w-0 items-center gap-2.5 rounded-2xl border border-[#E8E2F0] bg-white p-3 text-left shadow-[0_4px_14px_rgba(36,16,95,0.07)] transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#741CFF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#EEE8FF] text-[#741CFF]">
                <MessageCircle className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-[#24105F]">Online</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[#625B70]">
                  Tanpa perlu bertemu langsung
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#741CFF] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Tampilan desktop dipertahankan seperti desain sebelumnya */}
        <div className="hidden sm:block">
          <div className="mb-2 sm:mb-4">
            <span className="text-[11px] font-bold text-[#741CFF] tracking-wider uppercase">
              PILIH JENIS LAYANAN
            </span>
            <h2 className="mt-1 text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              Pilih layanan Offline atau Online
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#625B70]">
              Tentukan cara beraktivitas yang paling sesuai untukmu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onSelectMode('offline')}
              className="yuku-depth-card group relative min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E8E2F0] bg-white shadow-[0_4px_14px_rgba(36,16,95,0.07)] p-2.5 sm:p-5 backdrop-blur-md text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#741CFF]"
            >
              <span className="yuku-icon-orb mb-2 flex h-8 w-8 sm:mb-2.5 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[#741CFF] text-white">
                <span className="relative flex items-center justify-center" aria-hidden="true">
                  <UsersRound className="h-4 w-4 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
                  <span className="absolute -right-2 -bottom-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-white text-[#741CFF]">
                    <MapPin className="h-2.5 w-2.5" strokeWidth={2.7} />
                  </span>
                </span>
              </span>
              <span className="block text-sm sm:text-lg font-extrabold text-[#24105F]">Teman Offline</span>
              <span className="mt-1 block min-h-8 text-[10.5px] sm:mt-1.5 sm:min-h-9 sm:text-sm leading-relaxed text-[#625B70]">
                Teman untuk bertemu dan beraktivitas langsung.
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] sm:mt-3 sm:text-sm font-bold text-[#741CFF]">
                Cari teman offline <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('online')}
              className="yuku-depth-card group relative min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-white/10 p-2.5 sm:p-5 backdrop-blur-md text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#741CFF]"
            >
              <span className="yuku-icon-orb mb-2.5 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[#4b12b8] text-white">
                <span className="relative flex items-center justify-center" aria-hidden="true">
                  <Video className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
                  <span className="absolute -right-2 -bottom-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-white text-[#741CFF]">
                    <MessageCircle className="h-2.5 w-2.5" strokeWidth={2.7} />
                  </span>
                </span>
              </span>
              <span className="block text-sm sm:text-lg font-extrabold text-white">Teman Online</span>
              <span className="mt-1 block min-h-9 text-[11px] sm:text-sm leading-relaxed text-[#625B70]">
                Teman ngobrol dan berinteraksi dari mana saja.
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] sm:text-sm font-bold text-fuchsia-200">
                Cari teman online <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
