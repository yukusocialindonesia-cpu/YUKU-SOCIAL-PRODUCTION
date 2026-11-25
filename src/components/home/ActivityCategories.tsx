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
    const iconClass = 'w-6 h-6 sm:w-8 sm:h-8';
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

  // Satu palet konsisten terasa lebih eksklusif daripada ikon dengan enam warna berbeda.
  const tones = [{ orb: 'from-[#e5d5ff] to-[#a78bda]' }];

  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] bg-[radial-gradient(ellipse_at_50%_0%,rgba(126,34,206,0.28),transparent_58%),linear-gradient(180deg,#1b073b_0%,#200846_100%)] py-5 sm:py-10">
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-violet-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-fuchsia-600/15 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-fuchsia-200 sm:text-[10px]">
              <Sparkles className="h-3 w-3" /> PILIH PENGALAMAN
            </span>
            <h2 className="text-[21px] font-black tracking-tight text-white sm:text-3xl">
              Pilih aktivitasmu
            </h2>
            <p className="mt-1 max-w-[270px] text-[11px] leading-relaxed text-violet-100/75 sm:max-w-none sm:text-sm">
              Pilih aktivitas untuk menemukan Talent yang sesuai dengan kebutuhanmu.
            </p>
          </div>

        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[154px] animate-pulse rounded-[20px] border border-white/10 bg-white/[0.07] sm:h-[184px]" />
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {categories.map((cat) => {
              const tone = tones[0];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className="group relative flex min-h-[158px] cursor-pointer flex-col items-start justify-between overflow-hidden rounded-[20px] border border-white/[0.16] bg-gradient-to-br from-[#421477] via-[#2d1056] to-[#1d0b3a] p-3.5 text-left shadow-[0_12px_30px_rgba(5,0,20,0.28)] transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/50 hover:from-[#501b88] hover:to-[#28104c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b073b] sm:min-h-[184px] sm:rounded-[24px] sm:p-4"
                >
                  <span className={`pointer-events-none absolute -right-5 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tone.orb} opacity-[0.13] blur-2xl transition duration-300 group-hover:opacity-25`} />
                  <span className="relative flex w-full items-start justify-between gap-2">
                    <span className={`flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-gradient-to-br ${tone.orb} text-[#281044] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/30 transition duration-300 group-hover:scale-[1.03] sm:h-[62px] sm:w-[62px] sm:rounded-[20px]`}>
                      {getIcon(cat.iconName)}
                    </span>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-violet-100/80 transition duration-300 group-hover:border-fuchsia-200/40 group-hover:bg-fuchsia-300/15 group-hover:text-white">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span className="relative mt-2 block w-full">
                    <span className="block line-clamp-1 text-[14px] font-extrabold leading-tight tracking-tight text-white sm:text-[14px]">
                      {cat.title}
                    </span>
                    <span className="mt-1 block line-clamp-2 min-h-[25px] text-[11px] leading-snug text-violet-100/85 sm:text-[11px]">
                      {cat.description}
                    </span>
                    {cat.isOnlineAvailable && (
                      <span className="mt-1.5 inline-flex rounded-full border border-fuchsia-200/20 bg-fuchsia-300/10 px-2 py-0.5 text-[9px] font-bold text-fuchsia-100">
                        Online tersedia
                      </span>
                    )}
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
