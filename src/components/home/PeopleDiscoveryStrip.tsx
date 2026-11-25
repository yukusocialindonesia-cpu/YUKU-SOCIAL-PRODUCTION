import React, { useEffect, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { TalentProfile } from '../../types/talent';
import { fetchTalentsFromSupabase } from '../../utils/supabaseMarketplace';

interface PeopleDiscoveryStripProps {
  onSelectTalent: (talentId: string) => void;
  onViewAll: () => void;
}

/** Deretan profil untuk discovery bergaya aplikasi sosial. Tidak menampilkan status online/live karena presence belum tersedia. */
export const PeopleDiscoveryStrip: React.FC<PeopleDiscoveryStripProps> = ({ onSelectTalent, onViewAll }) => {
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchTalentsFromSupabase(8)
      .then((rows) => { if (mounted) setTalents(rows.slice(0, 8)); })
      .catch(() => { if (mounted) setTalents([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (!loading && talents.length === 0) return null;

  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-[#1b073b] text-white">
      <div className="mx-auto max-w-5xl px-4 pb-5 pt-4 sm:px-6 lg:px-8">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/10 text-fuchsia-200">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold tracking-tight">Kenalan di YUKU</h2>
              <p className="text-[10px] text-violet-200">Temukan orang baru untuk aktivitasmu</p>
            </div>
          </div>
          <button type="button" onClick={onViewAll} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-fuchsia-200 transition hover:text-white">
            Lihat semua <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
          {loading ? Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex w-[72px] shrink-0 snap-start flex-col items-center gap-2">
              <div className="h-[64px] w-[64px] animate-pulse rounded-full bg-white/10" />
              <div className="h-2 w-12 animate-pulse rounded-full bg-white/10" />
            </div>
          )) : talents.map((talent) => (
            <button
              key={talent.id}
              type="button"
              onClick={() => onSelectTalent(talent.id)}
              className="group flex w-[72px] shrink-0 snap-start flex-col items-center gap-1.5 text-center"
              aria-label={`Lihat profil ${talent.name}`}
            >
              <span className="relative block h-[64px] w-[64px] rounded-full bg-gradient-to-br from-fuchsia-400 via-violet-500 to-amber-300 p-[2px] shadow-[0_5px_18px_rgba(0,0,0,0.25)] transition duration-200 group-hover:scale-105">
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-[#1b073b] bg-[#3a1a65] text-lg font-extrabold text-white">
                  {talent.avatarUrl ? (
                    <img src={talent.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : talent.name.slice(0, 1).toUpperCase()}
                </span>
              </span>
              <span className="w-full truncate text-[10px] font-semibold text-violet-50 group-hover:text-white">{talent.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
