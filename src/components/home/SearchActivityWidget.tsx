import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Coffee, AlertCircle, RefreshCw } from 'lucide-react';
import { ActivityCategory, TalentProfile } from '../../types/talent';
import { fetchCategoriesFromSupabase, fetchTalentsFromSupabase } from '../../utils/supabaseMarketplace';
import { buildCityFilterOptions } from '../../utils/cities';

interface SearchActivityWidgetProps { onSearch: (activity: string, city: string) => void; }

export const SearchActivityWidget: React.FC<SearchActivityWidgetProps> = ({ onSearch }) => {
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('Semua Kota');

  const loadSearchData = async () => {
    setLoading(true); setErrorMsg(null);
    try {
      const [catsData, talentsData] = await Promise.all([fetchCategoriesFromSupabase(), fetchTalentsFromSupabase()]);
      setCategories(catsData); setTalents(talentsData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat pilihan pencarian dari Supabase.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSearchData(); }, []);
  const availableCities = useMemo(() => buildCityFilterOptions(talents.map((t) => t.city)), [talents]);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSearch(selectedActivity, selectedCity); };

  if (errorMsg) return (
    <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-800 shadow-sm">
      <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span>{errorMsg}</span></div>
      <button type="button" onClick={loadSearchData} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 font-bold text-white"><RefreshCw className="h-3 w-3" /> Coba Lagi</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl rounded-[18px] border border-[#E8E2F0] bg-white p-1.5 shadow-[0_5px_18px_rgba(36,16,95,0.08)] ring-0 sm:rounded-[26px] sm:p-3">
      <div className="grid grid-cols-2 items-center gap-1.5 sm:grid-cols-[1fr_1fr_auto] sm:gap-3">
        <div className="flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-[13px] border border-[#E8E2F0] bg-[#F8F7FC] px-2 py-1 sm:min-h-[58px] sm:px-4 sm:py-2 transition focus-within:border-[#741CFF] focus-within:bg-white">
          <Coffee className="h-4 w-4 shrink-0 text-[#741CFF] sm:h-5 sm:w-5" />
          <div className="min-w-0 flex-1 text-left">
            <label htmlFor="search-activity" className="mb-0 block text-[9px] sm:mb-0.5 sm:text-[10px] font-extrabold uppercase tracking-[.13em] text-[#827b91]">Aktivitas</label>
            <select id="search-activity" value={selectedActivity} disabled={loading} onChange={(e) => setSelectedActivity(e.target.value)} className="w-full cursor-pointer bg-transparent text-[12px] font-bold text-[#24105f] sm:text-sm outline-none disabled:opacity-50">
              <option value="all">{loading ? 'Memuat kategori...' : 'Semua aktivitas'}</option>
              {categories.map((act) => <option key={act.id} value={act.id}>{act.title}</option>)}
            </select>
          </div>
        </div>
        <div className="flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-[13px] border border-[#E8E2F0] bg-[#F8F7FC] px-2 py-1 sm:min-h-[58px] sm:gap-3 sm:rounded-[18px] sm:px-4 sm:py-2 transition focus-within:border-[#741CFF] focus-within:bg-white">
          <MapPin className="h-4 w-4 shrink-0 text-[#741CFF] sm:h-5 sm:w-5" />
          <div className="min-w-0 flex-1 text-left">
            <label htmlFor="search-city" className="mb-0 block text-[9px] font-extrabold uppercase tracking-[.13em] sm:mb-0.5 sm:text-[10px] text-[#827b91]">Lokasi</label>
            <select id="search-city" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="w-full cursor-pointer bg-transparent text-[12px] font-bold text-[#24105f] outline-none sm:text-sm">
              {availableCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="col-span-2 sm:col-span-1 inline-flex min-h-[48px] sm:min-h-[58px] items-center justify-center gap-2 rounded-[14px] sm:rounded-[18px] bg-[#741CFF] px-5 sm:px-7 text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(116,28,255,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#5F13D6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D9CCFF] disabled:cursor-not-allowed disabled:opacity-50">
          <Search className="h-4 w-4" /><span>Jelajahi</span>
        </button>
      </div>
    </form>
  );
};
