import React, { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { FAQ_ITEMS } from '../../utils/contentData';

interface HomeFaqSectionProps {
  onViewAllFaqClick: () => void;
}

export const HomeFaqSection: React.FC<HomeFaqSectionProps> = ({ onViewAllFaqClick }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="border-t border-slate-200 bg-white py-7 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-5 max-w-2xl sm:mb-7">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-purple-700">
            Pertanyaan Umum
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Sering Ditanyakan Seputar YUKU
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Jawaban transparan mengenai konsep pertemanan berbayar, keamanan, dan aturan platform.
          </p>
        </div>

        <div className="max-w-4xl space-y-2.5 sm:space-y-3">
          {FAQ_ITEMS.slice(0, 5).map((item, idx) => (
            <div
              key={item.q}
              className={`overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors duration-200 ${idx >= 4 ? 'hidden md:block' : ''}`}
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                aria-expanded={openIndex === idx}
                className="flex min-h-[52px] w-full items-center justify-between gap-4 bg-white px-4 py-3 text-left font-semibold text-slate-900 transition-colors hover:bg-slate-50 hover:text-purple-700 sm:px-5 sm:py-4"
              >
                <span className="text-sm sm:text-base leading-snug">{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openIndex === idx ? 'rotate-180 text-purple-600' : ''
                  }`}
                />
              </button>

              {openIndex === idx && (
                <div className="border-t border-slate-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600 sm:px-5 sm:py-4">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 max-w-4xl sm:mt-6">
          <button
            onClick={onViewAllFaqClick}
            className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-semibold text-purple-700 transition-colors hover:text-purple-900"
          >
            <span>Buka Pusat Bantuan & FAQ Lengkap</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
