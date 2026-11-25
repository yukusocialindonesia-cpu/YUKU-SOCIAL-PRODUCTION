import React from 'react';
import { UsersRound, MapPin, Video, MessageCircle, ArrowRight } from 'lucide-react';

interface ServiceModeSectionProps {
  onSelectMode: (mode: 'offline' | 'online') => void;
}

export const ServiceModeSection: React.FC<ServiceModeSectionProps> = ({ onSelectMode }) => {
  return (
    <section className="relative overflow-hidden py-4 sm:py-9 bg-gradient-to-r from-[#24105f] via-[#3b0d78] to-[#5416a6] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tampilan ringkas khusus HP */}
        <div className="sm:hidden">
          <div className="mb-2">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">
              Pilih Teman
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
              Mau bertemu langsung atau ngobrol online?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectMode('offline')}
              className="yuku-depth-card group flex min-h-[62px] min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
            >
              <span className="yuku-icon-orb flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2edff] text-[#5b22c7]">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-white">Offline</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-purple-100">
                  Bertemu langsung
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-200 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('online')}
              className="yuku-depth-card group flex min-h-[62px] min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2edff] text-[#5b22c7]">
                <MessageCircle className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-slate-900">Online</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                  Ngobrol dari mana saja
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-200 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Tampilan desktop dipertahankan seperti desain sebelumnya */}
        <div className="hidden sm:block">
          <div className="mb-2 sm:mb-4">
            <span className="text-[11px] font-bold text-fuchsia-200 tracking-wider uppercase">
              Pilih Cara Menemani
            </span>
            <h2 className="mt-1 text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              Mau Teman Offline atau Online?
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Pilih layanan yang sesuai dengan kebutuhanmu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onSelectMode('offline')}
              className="yuku-depth-card group relative min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-white/10 p-2.5 sm:p-5 backdrop-blur-md text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
            >
              <span className="yuku-icon-orb mb-2 flex h-8 w-8 sm:mb-2.5 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[#4b12b8] text-white">
                <span className="relative flex items-center justify-center" aria-hidden="true">
                  <UsersRound className="h-4 w-4 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
                  <span className="absolute -right-2 -bottom-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-white text-[#5b22c7]">
                    <MapPin className="h-2.5 w-2.5" strokeWidth={2.7} />
                  </span>
                </span>
              </span>
              <span className="block text-sm sm:text-lg font-extrabold text-white">Teman Offline</span>
              <span className="mt-1 block min-h-8 text-[10.5px] sm:mt-1.5 sm:min-h-9 sm:text-sm leading-relaxed text-purple-100">
                Teman untuk bertemu dan beraktivitas langsung.
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] sm:mt-3 sm:text-sm font-bold text-fuchsia-700">
                Cari teman offline <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('online')}
              className="yuku-depth-card group relative min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-white/10 p-2.5 sm:p-5 backdrop-blur-md text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <span className="yuku-icon-orb mb-2.5 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[#4b12b8] text-white">
                <span className="relative flex items-center justify-center" aria-hidden="true">
                  <Video className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
                  <span className="absolute -right-2 -bottom-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-white text-indigo-700">
                    <MessageCircle className="h-2.5 w-2.5" strokeWidth={2.7} />
                  </span>
                </span>
              </span>
              <span className="block text-sm sm:text-lg font-extrabold text-slate-900">Teman Online</span>
              <span className="mt-1 block min-h-9 text-[11px] sm:text-sm leading-relaxed text-slate-600">
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
