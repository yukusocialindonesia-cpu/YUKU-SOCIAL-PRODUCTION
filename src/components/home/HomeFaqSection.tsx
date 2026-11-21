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
    <section className="py-12 md:py-20 bg-[#140624] border-t border-purple-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <span className="text-xs font-bold !text-amber-300 tracking-wider uppercase mb-2 block">
            Pertanyaan Umum
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold !text-white tracking-tight mb-3">
            Sering Ditanyakan Seputar YUKU
          </h2>
          <p className="text-slate-200 text-sm">
            Jawaban transparan mengenai konsep pertemanan berbayar, keamanan, dan aturan platform.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.slice(0, 5).map((item, idx) => (
            <div
              key={item.q}
              className={`border border-purple-300/20 rounded-[20px] overflow-hidden bg-[#241039] shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition-all duration-300 ${idx >= 4 ? 'hidden md:block' : ''}`}
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-semibold !text-white hover:!text-amber-200 transition-colors cursor-pointer bg-[#241039] hover:bg-[#32164b]"
              >
                <span className="text-sm sm:text-base !text-white">{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 !text-purple-200 shrink-0 transition-transform duration-200 ${
                    openIndex === idx ? 'rotate-180 !text-amber-300' : ''
                  }`}
                />
              </button>

              {openIndex === idx && (
                <div className="px-5 py-4 text-xs sm:text-sm !text-purple-100 leading-relaxed border-t border-purple-300/20 bg-[#1b0c2d]">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onViewAllFaqClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold !text-[#1e0938] shadow-lg shadow-black/20 hover:bg-amber-200 hover:!text-[#1e0938] transition-colors cursor-pointer"
          >
            <span className="!text-[#1e0938]">Buka Pusat Bantuan & FAQ Lengkap</span>
            <ArrowRight className="w-4 h-4 !text-[#1e0938]" />
          </button>
        </div>
      </div>
    </section>
  );
};
