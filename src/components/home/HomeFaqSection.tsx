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
    <section className="py-5 md:py-12 bg-gradient-to-b from-[#17052f] via-[#1b073b] to-[#210847] border-t border-white/[0.06]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-3 md:mb-7">
          <span className="text-xs font-bold text-[#d7b8ff] tracking-wider uppercase mb-2 block">
            Pertanyaan Umum
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2 md:mb-3">
            Sering Ditanyakan Seputar YUKU
          </h2>
          <p className="max-w-2xl mx-auto text-purple-200/75 text-sm leading-relaxed">
            Jawaban transparan mengenai konsep pertemanan berbayar, keamanan, dan aturan platform.
          </p>
        </div>

        <div className="space-y-2 sm:space-y-2.5">
          {FAQ_ITEMS.slice(0, 5).map((item, idx) => (
            <div
              key={item.q}
              className="border border-white/12 rounded-2xl overflow-hidden bg-white/[0.07] shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                aria-expanded={openIndex === idx}
                className="w-full min-h-14 py-3 sm:py-4 px-4 sm:px-5 text-left flex items-center justify-between gap-4 font-semibold text-white hover:text-[#e4caff] transition-colors cursor-pointer bg-transparent hover:bg-white/[0.06]"
              >
                <span className="text-sm sm:text-base leading-snug">{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-purple-200/60 shrink-0 transition-transform duration-200 ${
                    openIndex === idx ? 'rotate-180 text-[#d7b8ff]' : ''
                  }`}
                />
              </button>

              {openIndex === idx && (
                <div className="px-4 sm:px-5 py-3 sm:py-4 text-sm text-purple-100/80 leading-relaxed border-t border-white/10 bg-black/10">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 sm:mt-8 text-center">
          <button
            onClick={onViewAllFaqClick}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-[#d7b8ff] hover:text-purple-900 hover:bg-purple-50 transition-colors cursor-pointer"
          >
            <span>Buka Pusat Bantuan & FAQ Lengkap</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
