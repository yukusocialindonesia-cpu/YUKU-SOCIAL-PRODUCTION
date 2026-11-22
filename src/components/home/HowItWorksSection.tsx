import React from 'react';
import { HOW_IT_WORKS_STEPS } from '../../utils/contentData';
import { ArrowRight, Search, CalendarClock, Smile, BadgeCheck } from 'lucide-react';

const STEP_ICONS = [Search, CalendarClock, Smile, BadgeCheck];

interface HowItWorksSectionProps {
  onLearnMoreClick: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ onLearnMoreClick }) => {
  return (
    <section className="bg-white py-6 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 max-w-2xl sm:mb-6">
          <span className="block text-xs font-semibold uppercase tracking-wide text-purple-700">
            Alur Mudah & Transparan
          </span>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Cara Kerja YUKU
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Dari memilih aktivitas sampai menikmati waktu bersama, semuanya dimulai dari langkah sederhana.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {HOW_IT_WORKS_STEPS.map((item, index) => {
            const Icon = STEP_ICONS[index % STEP_ICONS.length];
            return (
              <div
                key={item.step}
                className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-400">0{index + 1}</span>
                </div>
                <h3 className="text-sm font-bold leading-snug text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">{item.description}</p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onLearnMoreClick}
          className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-purple-700 transition-colors hover:text-purple-900"
        >
          <span>Pelajari Pedoman Etika & Panduan Lengkap</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};
