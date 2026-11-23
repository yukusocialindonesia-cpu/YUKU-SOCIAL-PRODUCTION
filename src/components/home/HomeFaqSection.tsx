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
    <section className="py-5 md:py-20 bg-white border-t border-purple-100/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4 md:mb-12">
          <span className="text-xs font-bold text-purple-700 tracking-wider uppercase mb-2 block">
            Pertanyaan Umum
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1E0938] tracking-tight mb-2 md:mb-3">
            Sering Ditanyakan Seputar YUKU
          </h2>
          <p className="max-w-2xl mx-auto text-slate-600 text-sm leading-relaxed">
            Jawaban transparan mengenai konsep pertemanan berbayar, keamanan, dan aturan platform.
          </p>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {FAQ_ITEMS.slice(0, 5).map((item, idx) => (
            <div
              key={item.q}
              className={`border border-purple-100/80 rounded-2xl overflow-hidden bg-white shadow-[0_6px_20px_rgba(76,29,149,0.06)] transition-all duration-200 ${idx >= 4 ? 'hidden md:block' : ''}`}
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                aria-expanded={openIndex === idx}
                className="w-full min-h-[52px] py-3 sm:py-4 px-4 sm:px-5 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 hover:text-purple-700 transition-colors cursor-pointer bg-white hover:bg-purple-50/40"
              >
                <span className="text-sm sm:text-base leading-snug">{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openIndex === idx ? 'rotate-180 text-purple-600' : ''
                  }`}
                />
              </button>

              {openIndex === idx && (
                <div className="px-4 sm:px-5 py-3 sm:py-4 text-sm text-slate-600 leading-relaxed border-t border-purple-50 bg-[#FEFDFF]">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 sm:mt-8 text-center">
          <button
            onClick={onViewAllFaqClick}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-purple-700 hover:text-purple-900 hover:bg-purple-50 transition-colors cursor-pointer"
          >
            <span>Buka Pusat Bantuan & FAQ Lengkap</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
