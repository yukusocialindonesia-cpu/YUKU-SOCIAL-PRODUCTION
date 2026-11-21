import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, HelpCircle, ArrowRight } from 'lucide-react';
import { FAQ_ITEMS } from '../utils/contentData';
import { AppRoute } from '../types/navigation';

interface FaqPageProps {
  onNavigate: (path: AppRoute) => void;
}

export const FaqPage: React.FC<FaqPageProps> = ({ onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const categories = ['Semua', 'Umum', 'Keamanan', 'Talent & Penghasilan', 'Status Platform'];

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      if (activeCategory !== 'Semua' && item.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="relative isolate overflow-hidden py-12 sm:py-16 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/80 via-[#FAF8FC] to-fuchsia-50/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 rounded-[2rem] border border-white/80 bg-white/55 px-5 py-8 shadow-[0_24px_70px_-38px_rgba(76,29,149,0.3)] backdrop-blur-xl sm:px-9">
          <span className="text-xs font-bold text-purple-700 tracking-wider uppercase mb-1 block">
            Pusat Informasi & Tanya Jawab
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1E0938] tracking-tight mb-3">
            Pertanyaan yang Sering Diajukan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Temukan informasi jelas seputar konsep paid companionship, peluang karir talent, kebijakan anti-kencan, dan keamanan pengguna.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari pertanyaan (contoh: kencan, talent, 18 tahun, pembayaran)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3.5 bg-white/85 border border-white rounded-2xl text-xs sm:text-sm shadow-[0_14px_35px_-24px_rgba(76,29,149,0.28)] ring-1 ring-purple-100/80 backdrop-blur-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-purple-800 to-fuchsia-700 text-white shadow-md shadow-purple-900/15 ring-1 ring-white/20'
                  : 'bg-white/75 text-slate-600 border border-white shadow-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3 mb-12">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((item, idx) => (
              <div
                key={item.q}
                className="bg-white/85 rounded-[1.35rem] border border-white shadow-[0_16px_42px_-30px_rgba(76,29,149,0.35)] ring-1 ring-purple-100/70 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:shadow-[0_20px_48px_-28px_rgba(76,29,149,0.38)]"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 hover:text-purple-700 transition-colors cursor-pointer"
                >
                  <span className="text-xs sm:text-sm">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      openIndex === idx ? 'rotate-180 text-purple-700' : ''
                    }`}
                  />
                </button>
                {openIndex === idx && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                    {item.a}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white/85 rounded-[1.5rem] border border-white ring-1 ring-purple-100 p-6 text-xs text-slate-500 shadow-lg shadow-purple-950/[0.04] backdrop-blur-xl">
              Tidak ada pertanyaan yang sesuai dengan kata kunci "{searchQuery}".
            </div>
          )}
        </div>

        {/* Still have questions card */}
        <div className="bg-gradient-to-br from-purple-50/95 to-fuchsia-50/90 rounded-[1.75rem] border border-white ring-1 ring-purple-100 p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_22px_55px_-35px_rgba(76,29,149,0.35)] backdrop-blur-xl">
          <div>
            <h3 className="font-bold text-sm text-purple-950">
              Masih Memiliki Pertanyaan Lain?
            </h3>
            <p className="text-xs text-purple-800/80 mt-0.5">
              Kunjungi Pusat Bantuan kami atau hubungi tim customer service YUKU.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/bantuan')}
            className="px-5 py-3 bg-gradient-to-r from-purple-700 to-fuchsia-700 hover:from-purple-800 hover:to-fuchsia-800 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-900/15 hover:-translate-y-0.5 hover:shadow-lg transition-all shrink-0"
          >
            Buka Pusat Bantuan
          </button>
        </div>
      </div>
    </div>
  );
};
