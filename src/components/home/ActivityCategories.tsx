import React, { useEffect, useState } from 'react';
import { Coffee, ShoppingBag, Film, Sparkles, Users, MessageCircle, RefreshCw, AlertCircle, ArrowUpRight } from 'lucide-react';
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
    const iconClass = 'w-6 h-6 sm:w-7 sm:h-7';
    switch (iconName) {
      case 'Coffee':
      case 'utensils':
        return <Coffee className={iconClass} />;
      case 'ShoppingBag':
        return <ShoppingBag className={iconClass} />;
      case 'Film':
        return <Film className={iconClass} />;
      case 'Sparkles':
        return <Sparkles className={iconClass} />;
      case 'Users':
        return <Users className={iconClass} />;
      case 'MessageCircle':
        return <MessageCircle className={iconClass} />;
      default:
        return <Sparkles className={iconClass} />;
    }
  };

  const tones = [
    { orb: 'from-violet-300 to-fuchsia-400', glow: 'shadow-[0_8px_24px_rgba(168,85,247,0.28)]' },
    { orb: 'from-pink-300 to-rose-400', glow: 'shadow-[0_8px_24px_rgba(244,63,94,0.24)]' },
    { orb: 'from-amber-200 to-orange-400', glow: 'shadow-[0_8px_24px_rgba(251,146,60,0.24)]' },
    { orb: 'from-cyan-200 to-blue-400', glow: 'shadow-[0_8px_24px_rgba(56,189,248,0.22)]' },
    { orb: 'from-emerald-200 to-teal-400', glow: 'shadow-[0_8px_24px_rgba(45,212,191,0.22)]' },
    { orb: 'from-indigo-200 to-violet-400', glow: 'shadow-[0_8px_24px_rgba(129,140,248,0.24)]' },
  ];

  return (
    <section className="relative overflow-hidden bg-[#17072f] py-6 sm:py-9">
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-violet-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-fuchsia-600/15 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300 sm:text-[11px]">
              Temukan keseruanmu
            </span>
            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Mau aktivitas apa hari ini?
            </h2>
            <p className="mt-1 text-xs text-violet-200/75 sm:text-sm">
              Pilih aktivitas, temukan teman yang cocok.
            </p>
          </div>
          <span className="mb-1 hidden items-center gap-1 text-xs font-bold text-fuchsia-200 sm:flex">
            Jelajahi <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[116px] animate-pulse rounded-[20px] border border-white/10 bg-white/[0.07] sm:h-[132px]" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-xs text-rose-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-300" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={loadCategories} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 font-bold text-white hover:bg-rose-400">
              <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center text-xs text-violet-100/70">
            Aktivitas belum tersedia. Coba lagi beberapa saat.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {categories.map((cat, idx) => {
              const tone = tones[idx % tones.length];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className="group relative flex min-h-[116px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border border-white/[0.11] bg-gradient-to-b from-white/[0.13] to-white/[0.055] px-2 py-4 text-center shadow-[0_10px_28px_rgba(5,0,20,0.2)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/40 hover:from-white/[0.19] hover:to-white/[0.09] sm:min-h-[132px] sm:rounded-[22px]"
                >
                  <span className={`relative flex h-12 w-12 items-center justify-center rounded-[17px] bg-gradient-to-br ${tone.orb} text-[#281044] ${tone.glow} transition duration-300 group-hover:scale-110 group-hover:rotate-3 sm:h-14 sm:w-14 sm:rounded-[19px]`}>
                    {getIcon(cat.iconName)}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-extrabold leading-tight text-white sm:text-[13px]">
                    {cat.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
