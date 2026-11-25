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
    const iconClass = 'w-[17px] h-[17px] sm:w-8 sm:h-8';
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
  const tones = [{ orb: 'from-[#EEE8FF] to-[#D9CCFF]' }];

  return (
    <section className="relative overflow-hidden border-y border-[#EEEAF5] bg-[#F8F7FC] py-3.5 sm:py-10">
      
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-2 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-[#E8E2F0] bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#741CFF] sm:text-[10px]">
              <Sparkles className="h-3 w-3" /> PILIH PENGALAMAN
            </span>
            <h2 className="text-[18px] font-black tracking-tight text-[#24105F] sm:text-3xl">
              Pilih aktivitasmu
            </h2>
            <p className="mt-0.5 max-w-[270px] text-[10px] leading-snug text-[#625B70] sm:max-w-none sm:text-sm">
              Pilih aktivitas untuk menemukan Talent yang sesuai dengan kebutuhanmu.
            </p>
          </div>

        </div>

        {loading ? (
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[62px] min-w-0 animate-pulse rounded-xl border border-[#E8E2F0] bg-white sm:h-[184px] sm:rounded-[20px]" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={loadCategories} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 font-bold text-white hover:bg-rose-400">
              <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-[#e9e0f0] bg-white p-5 text-center text-xs text-[#74677f]">
            Aktivitas belum tersedia. Coba lagi beberapa saat.
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {categories.map((cat) => {
              const tone = tones[0];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className="group relative flex min-h-[62px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-[#E8E2F0] bg-white px-0.5 py-1 text-center shadow-[0_2px_7px_rgba(36,16,95,0.05)] transition duration-200 hover:border-[#741CFF] hover:shadow-[0_5px_12px_rgba(36,16,95,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#741CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F7FC] sm:min-h-[184px] sm:items-start sm:justify-between sm:gap-0 sm:rounded-[24px] sm:p-4 sm:text-left"
                >
                  <span className={`pointer-events-none absolute -right-5 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tone.orb} opacity-[0.20] blur-2xl transition duration-300 group-hover:opacity-35`} />
                  <span className="relative flex w-full items-center justify-center sm:items-start sm:justify-between sm:gap-2">
                    <span className={`flex h-[29px] w-[29px] items-center justify-center rounded-[9px] bg-[#EEE8FF] text-[#741CFF] sm:h-[62px] sm:w-[62px] sm:rounded-[20px]`}>
                      {getIcon(cat.iconName)}
                    </span>
                    <span className="mt-0.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E8E2F0] bg-[#F8F7FC] text-[#741CFF] transition duration-300 group-hover:border-[#d6c1e8] group-hover:bg-[#eee3f7] group-hover:text-[#4c2670] sm:flex">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span className="relative block w-full sm:mt-1.5">
                    <span className="block line-clamp-2 break-words text-[9px] font-bold leading-[1.1] tracking-tight text-[#24105F] sm:line-clamp-1 sm:text-[14px]">
                      {cat.title}
                    </span>
                    <span className="mt-0.5 hidden min-h-[24px] text-[11px] leading-snug text-[#786b83] sm:block sm:line-clamp-2">
                      {cat.description}
                    </span>
                    {cat.isOnlineAvailable && (
                      <span className="mt-1 hidden rounded-full border border-[#eadcf4] bg-[#f5eefb] px-2 py-0.5 text-[9px] font-bold text-[#704294] sm:inline-flex">
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
