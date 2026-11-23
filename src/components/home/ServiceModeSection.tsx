import React from 'react';
import { MapPin, MessageCircle, ArrowRight } from 'lucide-react';

interface ServiceModeSectionProps {
  onSelectMode: (mode: 'offline' | 'online') => void;
}

export const ServiceModeSection: React.FC<ServiceModeSectionProps> = ({ onSelectMode }) => {
  return (
    <section className="relative bg-gradient-to-b from-white via-[#FCFAFF] to-[#F8F5FF] py-3 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-2 sm:mb-6">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Pilih Teman
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">
            Mau bertemu langsung atau ngobrol online?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
          <button
            type="button"
            onClick={() => onSelectMode('offline')}
            className="group flex min-w-0 items-center gap-2 rounded-xl border border-fuchsia-100 bg-white p-3 text-left shadow-sm transition hover:border-fuchsia-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 sm:gap-3 sm:rounded-2xl sm:p-5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-50 text-fuchsia-700 sm:h-10 sm:w-10">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-900 sm:text-base">Offline</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500 sm:text-sm">
                Bertemu langsung
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-600 transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectMode('online')}
            className="group flex min-w-0 items-center gap-2 rounded-xl border border-purple-100 bg-white p-3 text-left shadow-sm transition hover:border-purple-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:gap-3 sm:rounded-2xl sm:p-5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-700 sm:h-10 sm:w-10">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-900 sm:text-base">Online</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500 sm:text-sm">
                Ngobrol dari mana saja
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-purple-600 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
