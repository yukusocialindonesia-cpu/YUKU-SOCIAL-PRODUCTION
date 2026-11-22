import React from 'react';
import { UsersRound, MapPin, Video, MessageCircle, ArrowRight } from 'lucide-react';

interface ServiceModeSectionProps {
  onSelectMode: (mode: 'offline' | 'online') => void;
}

export const ServiceModeSection: React.FC<ServiceModeSectionProps> = ({ onSelectMode }) => {
  return (
    <section className="relative overflow-hidden py-5 sm:py-12 bg-gradient-to-b from-white via-[#FCFAFF] to-[#F8F5FF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-3 sm:mb-6">
          <span className="text-[11px] font-bold text-purple-700 tracking-wider uppercase">
            Pilih Cara Menemani
          </span>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Mau Teman Offline atau Online?
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Pilih pengalaman yang sesuai dengan kebutuhanmu.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => onSelectMode('offline')}
            className="group relative min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-fuchsia-100/90 bg-white p-3 sm:p-5 text-left shadow-[0_8px_24px_rgba(124,58,237,0.07)] hover:shadow-[0_16px_34px_rgba(124,58,237,0.14)] hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
          >
            <span className="mb-2.5 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white shadow-md shadow-fuchsia-200/70">
              <span className="relative flex items-center justify-center" aria-hidden="true">
                <UsersRound className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
                <span className="absolute -right-2 -bottom-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-white text-fuchsia-700">
                  <MapPin className="h-2.5 w-2.5" strokeWidth={2.7} />
                </span>
              </span>
            </span>
            <span className="block text-sm sm:text-lg font-extrabold text-slate-900">Teman Offline</span>
            <span className="mt-1.5 block min-h-9 text-[11px] sm:text-sm leading-relaxed text-slate-600">
              Teman untuk bertemu dan beraktivitas langsung.
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] sm:text-sm font-bold text-fuchsia-700">
              Cari teman offline <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectMode('online')}
            className="group relative min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-purple-100/90 bg-white p-3 sm:p-5 text-left shadow-[0_8px_24px_rgba(124,58,237,0.07)] hover:shadow-[0_16px_34px_rgba(124,58,237,0.14)] hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <span className="mb-2.5 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md shadow-purple-200/70">
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
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] sm:text-sm font-bold text-purple-700">
              Cari teman online <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
