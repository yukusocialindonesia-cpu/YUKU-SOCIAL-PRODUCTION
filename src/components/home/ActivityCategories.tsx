import React, { useEffect, useState } from 'react';
import { Coffee, ShoppingBag, Film, Sparkles, Users, MessageCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { ActivityCategory, ActivityCategoryId } from '../../types/talent';
import { fetchCategoriesFromSupabase } from '../../utils/supabaseMarketplace';

interface ActivityCategoriesProps {
  onSelectCategory: (categoryId: ActivityCategoryId) => void;
}

export const ActivityCategories: React.FC<ActivityCategoriesProps> = ({ onSelectCategory }) => {
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchCategoriesFromSupabase();
      setCategories(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data kategori dari Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Coffee':
      case 'utensils':
        return <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'Film':
        return <Film className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'Users':
        return <Users className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'MessageCircle':
        return <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />;
      default:
        return <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />;
    }
  };

  /* Grid 3 kolom menjaga pilihan aktivitas langsung terlihat di layar HP. */
  const gridClass = 'grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[repeat(auto-fit,minmax(132px,1fr))]';

  return (
    <section className="relative py-4 sm:py-9 bg-gradient-to-b from-[#eee5ff] via-[#f7f2ff] to-[#f9f6ff]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-3 sm:mb-5 gap-1 md:gap-4">
          <div>
            <span className="text-[10px] sm:text-[11px] font-extrabold text-[#741cff] tracking-[0.14em] uppercase mb-1 block">
              Pilihan Pengalaman Sosial
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-[#24105f] tracking-tight">
              Aktivitas Seru Bersama Teman Baru
            </h2>
          </div>
          {/* Teks penjelas hanya di layar lebar */}
          <p className="hidden xl:block text-sm text-slate-500 max-w-md">
            Mulai dari bersantai di kafe, berbelanja, menonton pertunjukan, hingga sesi mengobrol suportif online.
          </p>
        </div>

        {loading ? (
          <div className={gridClass}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-[#eee9f8] bg-white animate-pulse h-[100px] sm:h-[116px]" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadCategories}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold flex items-center gap-1 hover:bg-rose-700 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
            Belum ada data kategori aktivitas aktif di Supabase.
          </div>
        ) : (
          <div className={gridClass}>
            {categories.map((cat, idx) => {
              const tones = [
                'bg-gradient-to-br from-[#eee5ff] to-[#d9c4ff] text-[#5414bd] ring-[#d8c5ff]',
                'bg-gradient-to-br from-[#ffe8f3] to-[#ffc9e2] text-[#bd2877] ring-[#ffd2e7]',
                'bg-gradient-to-br from-[#fff1d8] to-[#ffdda0] text-[#9a5a00] ring-[#ffe4b5]',
              ];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className="group flex min-h-[100px] sm:min-h-[116px] flex-col items-center justify-center gap-2 rounded-[18px] border border-white/90 bg-white/95 px-1.5 py-3 shadow-[0_8px_24px_rgba(36,16,95,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-[#d8c9f5] hover:shadow-[0_16px_34px_rgba(36,16,95,0.13)] cursor-pointer focus-visible:outline-2 focus-visible:outline-purple-600"
                >
                  <span className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] flex items-center justify-center ring-1 ring-inset shadow-[0_4px_12px_rgba(36,16,95,0.06)] ${tones[idx % tones.length]} group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-300`}>
                    {getIcon(cat.iconName)}
                  </span>
                  <h3 className="font-extrabold text-[11px] sm:text-[13px] leading-tight text-center text-[#302052] group-hover:text-[#5b22c7] transition-colors">
                    {cat.title}
                  </h3>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
