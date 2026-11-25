import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertCircle, RefreshCw, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { TalentProfile } from '../../types/talent';
import { TalentCard } from '../talent/TalentCard';
import {
  TalentQuickFilter,
  QuickFilter,
  matchesQuickFilter,
  useAvailableTodayIds,
} from '../talent/TalentQuickFilter';
import { fetchTalentsFromSupabase } from '../../utils/supabaseMarketplace';
import { supabase } from '../../lib/supabase';

interface FeaturedTalentSectionProps {
  onSelectTalent: (talentId: string) => void;
  onViewAllClick: () => void;
}

export const FeaturedTalentSection: React.FC<FeaturedTalentSectionProps> = ({
  onSelectTalent,
  onViewAllClick,
}) => {
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [mediaTypesByTalent, setMediaTypesByTalent] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollByCards = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' });
  };
  const { availableTodayIds, todayReady } = useAvailableTodayIds(talents);

  const loadFeaturedTalents = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchTalentsFromSupabase(10);
      setTalents(data);

      // Ambil jenis media semua Talent sekaligus, bukan satu query per kartu.
      const talentIds = data.map((talent) => talent.id);
      if (talentIds.length > 0) {
        try {
          const { data: mediaRows, error } = await supabase
            .from('talent_media')
            .select('talent_id, media_type')
            .in('talent_id', talentIds);
          if (error) throw error;

          const grouped: Record<string, string[]> = {};
          (mediaRows ?? []).forEach((media: { talent_id: string; media_type: string }) => {
            const types = grouped[media.talent_id] ?? [];
            if (!types.includes(String(media.media_type))) types.push(String(media.media_type));
            grouped[media.talent_id] = types;
          });
          setMediaTypesByTalent(grouped);
        } catch {
          // Informasi media hanya indikator tambahan; kartu tetap tampil jika query gagal.
          setMediaTypesByTalent({});
        }
      } else {
        setMediaTypesByTalent({});
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data Talent dari Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Data Talent cukup dimuat saat bagian ini mendekati layar, bukan saat halaman baru dibuka.
  useEffect(() => {
    const target = sectionRef.current;
    if (!target) return;

    let hasStarted = false;
    let observer: IntersectionObserver | null = null;

    const startLoading = () => {
      if (hasStarted) return;
      hasStarted = true;
      void loadFeaturedTalents();
    };

    if (typeof IntersectionObserver === 'undefined') {
      startLoading();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            startLoading();
            observer?.disconnect();
          }
        },
        { rootMargin: '300px 0px' }
      );
      observer.observe(target);
    }

    return () => observer?.disconnect();
  }, []);

  // Beranda menampilkan maksimal enam Talent; daftar lengkap tetap tersedia melalui tombol Lihat Semua.
  const visibleTalents = talents.filter((t) => matchesQuickFilter(t, quickFilter, availableTodayIds)).slice(0, 6);

  return (
    <section ref={sectionRef} className="relative overflow-hidden border-t border-white/[0.06] py-4 md:py-10 bg-gradient-to-br from-[#1b073b] via-[#2a0b59] to-[#421078] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-2 md:mb-5 gap-2 md:gap-4">
          <div>
            <span className="text-[10.5px] sm:text-xs font-bold text-fuchsia-200 tracking-wider uppercase mb-0.5 sm:mb-1 block">
              Temukan teman untuk aktivitasmu
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              Talent Pilihan YUKU
            </h2>
          </div>
          <button
            onClick={onViewAllClick}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-fuchsia-200 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b073b]"
          >
            <span className="md:hidden">Lihat Semua</span>
            <span className="hidden md:inline">Lihat Semua Talent</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {!loading && !errorMsg && talents.length > 0 && (
          <div className="mb-1.5 md:mb-6">
            <TalentQuickFilter value={quickFilter} onChange={setQuickFilter} showToday={todayReady} />
          </div>
        )}

        {loading ? (
          <div className="flex gap-3 overflow-hidden rounded-[30px] p-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] h-auto w-[46vw] max-w-[184px] shrink-0 rounded-2xl bg-white/10 animate-pulse sm:w-[196px]" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadFeaturedTalents}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold flex items-center gap-1 hover:bg-rose-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : talents.length === 0 ? (
          <div className="p-8 text-center bg-white/10 rounded-2xl border border-white/10 text-xs text-purple-100">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p>Belum ada profil Talent aktif yang terdaftar di Supabase.</p>
          </div>
        ) : visibleTalents.length === 0 ? (
          <div className="p-8 text-center bg-white/10 rounded-2xl border border-white/10 text-xs text-purple-100">
            <p className="mb-3">Belum ada talent yang cocok dengan filter ini.</p>
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className="px-4 py-2 bg-purple-700 text-white font-semibold rounded-lg hover:bg-purple-800 transition-colors cursor-pointer"
            >
              Tampilkan semua
            </button>
          </div>
        ) : (
          <div className="relative">
          <button
            type="button"
            aria-label="Geser ke kiri"
            onClick={() => scrollByCards(-1)}
            className="hidden lg:flex absolute -left-4 top-1/3 z-10 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-purple-100 text-purple-800 hover:bg-purple-50 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Geser ke kanan"
            onClick={() => scrollByCards(1)}
            className="hidden lg:flex absolute -right-4 top-1/3 z-10 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-purple-100 text-purple-800 hover:bg-purple-50 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] font-semibold text-fuchsia-100/75 sm:hidden">
            <span>Profil pilihan untuk kamu</span>
            <span className="inline-flex items-center gap-1">Geser <ChevronRight className="h-3 w-3" /></span>
          </div>
          <div
            ref={scrollRef}
            aria-label="Daftar talent pilihan, geser untuk melihat profil lainnya"
            className="flex gap-2.5 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-3 sm:pb-5 pt-0 -mx-4 px-4 scroll-px-4 sm:mx-0 sm:gap-4 sm:px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleTalents.map((talent, i) => (
              <motion.div
                key={talent.id}
                className="snap-start shrink-0 flex [&>article]:w-full w-[42vw] max-w-[160px] sm:w-[190px] lg:w-[calc((100%-4rem)/5)] rounded-[20px] p-0.5"
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: Math.min(i, 5) * 0.06, ease: 'easeOut' }}
              >
                <TalentCard
                  talent={talent}
                  onSelect={onSelectTalent}
                  availableToday={availableTodayIds.has(talent.id)}
                  mediaTypes={mediaTypesByTalent[talent.id] ?? []}
                  showPrice={false}
                  compact
                />
              </motion.div>
            ))}
          </div>
          </div>
        )}
      </div>
    </section>
  );
};
