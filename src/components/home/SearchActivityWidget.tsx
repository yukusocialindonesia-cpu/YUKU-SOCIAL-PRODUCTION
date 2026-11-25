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
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl rounded-[26px] border border-white/80 bg-white p-2.5 shadow-[0_20px_60px_rgba(38,16,95,0.13)] ring-1 ring-[#eee9f8] sm:p-3">
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto] sm:gap-3">
        <div className="flex min-h-[58px] min-w-0 items-center gap-3 rounded-[18px] border border-[#f0edf6] bg-[#fcfbfe] px-4 py-2 transition focus-within:border-[#bca4f5] focus-within:bg-white">
          <Coffee className="h-5 w-5 shrink-0 text-[#5b22c7]" />
          <div className="min-w-0 flex-1 text-left">
            <label htmlFor="search-activity" className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#827b91]">Aktivitas</label>
            <select id="search-activity" value={selectedActivity} disabled={loading} onChange={(e) => setSelectedActivity(e.target.value)} className="w-full cursor-pointer bg-transparent text-sm font-bold text-[#24105f] outline-none disabled:opacity-50">
              <option value="all">{loading ? 'Memuat kategori...' : 'Semua aktivitas'}</option>
              {categories.map((act) => <option key={act.id} value={act.id}>{act.title}</option>)}
            </select>
          </div>
        </div>
        <div className="flex min-h-[58px] min-w-0 items-center gap-3 rounded-[18px] border border-[#f0edf6] bg-[#fcfbfe] px-4 py-2 transition focus-within:border-[#bca4f5] focus-within:bg-white">
          <MapPin className="h-5 w-5 shrink-0 text-[#5b22c7]" />
          <div className="min-w-0 flex-1 text-left">
            <label htmlFor="search-city" className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#827b91]">Lokasi</label>
            <select id="search-city" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="w-full cursor-pointer bg-transparent text-sm font-bold text-[#24105f] outline-none">
              {availableCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-yuku-gradient px-7 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(83,28,184,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(83,28,184,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9c9ff] disabled:cursor-not-allowed disabled:opacity-50">
          <Search className="h-4 w-4" /><span>Jelajahi</span>
        </button>
      </div>
    </form>
  );
};
