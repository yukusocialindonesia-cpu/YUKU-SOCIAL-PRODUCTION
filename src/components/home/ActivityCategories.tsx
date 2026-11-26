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
        return <Coffee className="h-4 w-4" />;
      case 'ShoppingBag':
        return <ShoppingBag className="h-4 w-4" />;
      case 'Film':
        return <Film className="h-4 w-4" />;
      case 'Sparkles':
        return <Sparkles className="h-4 w-4" />;
      case 'Users':
        return <Users className="h-4 w-4" />;
      case 'MessageCircle':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <Coffee className="h-4 w-4" />;
    }
  };

  // Satu baris horizontal di semua ukuran layar; kartu ringkas agar aktivitas
  // terlihat tanpa membuat Beranda memanjang seperti katalog penuh.
  const railClass = 'flex gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0';

  return (
    <section className="relative bg-gradient-to-b from-white via-[#FCFAFF] to-[#F8F5FF] py-3 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-purple-700">
              Pilihan Pengalaman Sosial
            </span>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Pilihan Aktivitas
            </h2>
          </div>
          <span className="shrink-0 pb-0.5 text-[10px] font-medium text-slate-500 sm:text-xs">
            Geser untuk lihat
          </span>
        </div>

        {loading ? (
          <div className={railClass} aria-label="Memuat kategori aktivitas">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[76px] w-[88px] shrink-0 animate-pulse rounded-xl border border-purple-100 bg-white sm:w-[104px]" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={loadCategories}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
            Belum ada kategori aktivitas aktif.
          </div>
        ) : (
          <div className={railClass}>
            {categories.map((cat, idx) => {
              const tones = [
                'bg-purple-100 text-purple-700',
                'bg-fuchsia-100 text-fuchsia-700',
                'bg-amber-100 text-amber-700',
                'bg-sky-100 text-sky-700',
                'bg-rose-100 text-rose-700',
                'bg-emerald-100 text-emerald-700',
              ];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className="group flex min-h-[76px] w-[88px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border border-purple-100 bg-white px-2 py-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 sm:min-h-[88px] sm:w-[104px] sm:gap-2 sm:rounded-2xl sm:py-3"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${tones[idx % tones.length]}`}>
                    {getIcon(cat.iconName)}
                  </span>
                  <span className="line-clamp-2 text-[10px] font-bold leading-tight text-slate-800 group-hover:text-purple-700 sm:text-[11px]">
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
