import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Coffee, AlertCircle, RefreshCw } from 'lucide-react';
import { ActivityCategory } from '../../types/talent';
import { fetchCategoriesFromSupabase } from '../../utils/supabaseMarketplace';
import { buildCityFilterOptions } from '../../utils/cities';
import { supabase } from '../../lib/supabase';

interface SearchActivityWidgetProps {
  onSearch: (activity: string, city: string) => void;
}

export const SearchActivityWidget: React.FC<SearchActivityWidgetProps> = ({ onSearch }) => {
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [talentCities, setTalentCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('Semua Kota');

  const loadSearchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [catsData, citiesResult] = await Promise.all([
        fetchCategoriesFromSupabase(),
        supabase.from('talent_profiles').select('city').not('city', 'is', null),
      ]);
      setCategories(catsData);
      if (citiesResult.error) {
        console.info('YUKU: daftar kota Talent tidak tersedia; memakai direktori kota Indonesia.', citiesResult.error.message);
        setTalentCities([]);
      } else {
        setTalentCities((citiesResult.data ?? []).map((row) => row.city).filter((city): city is string => Boolean(city?.trim())));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat pilihan pencarian dari Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSearchData();
  }, []);

  // Ambil hanya kolom kota, bukan seluruh profil Talent beserta layanan terkait.
  // Direktori statis tetap menjadi fallback dan kota khusus tetap dapat dicari.
  const availableCities = useMemo(() => buildCityFilterOptions(talentCities), [talentCities]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(selectedActivity, selectedCity);
  };

  if (errorMsg) {
    return (
      <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl max-w-4xl mx-auto text-xs text-rose-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
        <button
          type="button"
          onClick={loadSearchData}
          className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Coba Lagi</span>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gradient-to-br from-white via-white to-purple-50/70 p-2 md:p-4 rounded-[22px] shadow-[0_12px_30px_rgba(76,29,149,0.10)] border border-purple-100 max-w-4xl mx-auto"
    >
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-12 gap-2 md:gap-3 items-center">
        {/* Aktivitas Selector */}
        <div className="min-w-0 md:col-span-5 flex items-center gap-3 px-3 md:px-3 py-2.5 md:py-3 min-h-[56px] bg-white hover:bg-purple-50/50 rounded-xl border border-purple-100 shadow-sm transition-colors">
          <Coffee className="hidden md:block w-5 h-5 text-purple-700 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <label htmlFor="search-activity" className="block text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="md:hidden">Aktivitas</span>
              <span className="hidden md:inline">Pilihan Aktivitas</span>
            </label>
            <select
              id="search-activity"
              value={selectedActivity}
              disabled={loading}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="all">
                {loading ? 'Memuat Kategori...' : 'Semua Aktivitas'}
              </option>
              {categories.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Kota Selector */}
        <div className="min-w-0 md:col-span-4 flex items-center gap-3 px-3 md:px-3 py-2.5 md:py-3 min-h-[56px] bg-white hover:bg-purple-50/50 rounded-xl border border-purple-100 shadow-sm transition-colors">
          <MapPin className="hidden md:block w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <label htmlFor="search-city" className="block text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="md:hidden">Kota</span>
              <span className="hidden md:inline">Lokasi Kota</span>
            </label>
            <select
              id="search-city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="col-span-1 min-[360px]:col-span-2 md:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 md:min-h-12 py-2 md:py-3 px-5 bg-gradient-to-r from-purple-800 via-purple-700 to-fuchsia-600 hover:from-purple-900 hover:to-fuchsia-700 text-white font-bold text-sm rounded-xl shadow-[0_8px_18px_rgba(109,40,217,0.24)] hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>Cari Talent</span>
          </button>
        </div>
      </div>
    </form>
  );
};
