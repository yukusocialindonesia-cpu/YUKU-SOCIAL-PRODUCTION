import React from 'react';
import { ArrowRight, BriefcaseBusiness } from 'lucide-react';

export const ProfessionalServicesSection: React.FC<{ onViewAll: () => void }> = ({ onViewAll }) => {
  return (
    <section className="bg-white py-3 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onViewAll}
          className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left transition hover:border-purple-200 hover:bg-purple-50/60 sm:p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-slate-900 sm:text-base">Butuh Jasa Profesional?</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600 sm:text-sm">
              Temukan penyedia jasa dan keahlian untuk kebutuhanmu.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-purple-800 sm:text-xs">
            Jelajahi <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>
    </section>
  );
};
