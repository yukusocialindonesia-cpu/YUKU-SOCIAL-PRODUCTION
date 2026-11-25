import React from 'react';
import { HOW_IT_WORKS_STEPS } from '../../utils/contentData';
import { ArrowRight, Search, CalendarCheck, ClipboardCheck, Star, BadgeCheck, Lock, Headphones, Heart } from 'lucide-react';

const STEP_ICONS = [Search, CalendarCheck, ClipboardCheck, Star];

const TRUST_ITEMS = [
  { label: 'Profil Terverifikasi', Icon: BadgeCheck },
  { label: 'Data Aman', Icon: Lock },
  { label: 'Dukungan Admin', Icon: Headphones },
  { label: 'Komunitas Positif', Icon: Heart },
];

interface HowItWorksSectionProps {
  onLearnMoreClick: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ onLearnMoreClick }) => {
  return (
    <section className="py-5 md:py-10 bg-[#F8F7FC] border-t border-[#EEEAF5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-10">
          {/* Cara Kerja */}
          <div className="lg:col-span-8">
            <span className="text-[11px] font-bold text-[#741CFF] tracking-wider uppercase block">
              Alur Mudah & Transparan
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#24105F] tracking-tight mb-3 sm:mb-5">
              Cara Kerja YUKU
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {HOW_IT_WORKS_STEPS.map((item, index) => {
                const Icon = STEP_ICONS[index % STEP_ICONS.length];
                return (
                  <div
                    key={item.step}
                    className="flex flex-col items-center text-center bg-white border border-[#E8E2F0] rounded-[20px] sm:rounded-[22px] p-3 sm:p-4 shadow-[0_5px_16px_rgba(36,16,95,0.06)] hover:-translate-y-1 hover:bg-white transition-all duration-300"
                  >
                    <div className="relative mb-2">
                      <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-[15px] sm:rounded-2xl bg-gradient-to-br from-[#24105F] to-[#741CFF] text-white flex items-center justify-center shadow-[0_5px_12px_rgba(126,34,206,0.22)] ring-2 ring-white">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                      </span>
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#741CFF] text-white text-[11px] font-black flex items-center justify-center ring-2 ring-white">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="text-[14px] font-bold text-[#24105F] mb-1 leading-tight tracking-tight">{item.title}</h3>
                    <p className="text-[13px] text-[#625B70] leading-snug line-clamp-4">{item.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Simbol alur berupa ikon di bawah kartu langkah */}
            <div
              className="hidden sm:flex mt-3 items-center justify-center gap-2 sm:gap-3"
              aria-label="Alur proses YUKU: cari talent, pilih jadwal, konfirmasi aktivitas, dan beri ulasan"
            >
              {HOW_IT_WORKS_STEPS.map((item, index) => {
                const Icon = STEP_ICONS[index % STEP_ICONS.length];
                return (
                  <React.Fragment key={item.step}>
                    <span
                      className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-[#E8E2F0] bg-white text-[#741CFF] shadow-sm"
                      title={item.title}
                    >
                      <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
                    </span>
                    {index < HOW_IT_WORKS_STEPS.length - 1 && (
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#741CFF]" aria-hidden="true" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <button
              onClick={onLearnMoreClick}
              className="mt-3 sm:mt-5 min-h-11 inline-flex items-center gap-2 text-sm font-bold text-[#741CFF] hover:text-[#24105F] transition-colors cursor-pointer"
            >
              <span>Pelajari Pedoman Etika & Panduan Lengkap</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Keamanan & Kepercayaan */}
          <div className="hidden lg:block lg:col-span-4 lg:border-l lg:border-[#E8E2F0] lg:pl-10">
            <span className="text-[11px] font-bold text-[#741CFF] tracking-wider uppercase block">
              Privasi & Keamanan
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#24105F] tracking-tight mb-1">
              Keamanan & Kepercayaan
            </h2>
            <p className="text-sm text-[#625B70] mb-4 md:mb-5">Privasi dan keamananmu adalah prioritas kami.</p>
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-3">
              {TRUST_ITEMS.map(({ label, Icon }) => (
                <div key={label} className="flex flex-col lg:flex-row items-center lg:gap-3 text-center lg:text-left">
                  <span className="w-9 h-9 md:w-12 md:h-12 shrink-0 rounded-2xl bg-[#EEE8FF] border border-[#E8E2F0] text-[#741CFF] shadow-[0_4px_12px_rgba(36,16,95,0.06)] flex items-center justify-center">
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                  </span>
                  <span className="mt-1.5 lg:mt-0 text-xs lg:text-sm font-semibold text-[#625B70] leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
