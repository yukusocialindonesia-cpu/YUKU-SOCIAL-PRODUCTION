import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users, RotateCcw, AlertCircle, RefreshCw } from 'lucide-react';
import { TalentProfile, ActivityCategory, GenderType } from '../types/talent';
import { TalentCard } from '../components/talent/TalentCard';
import { LocationFilter } from '../components/talent/LocationFilter';
import { AppRoute } from '../types/navigation';
import { fetchTalentsFromSupabase, fetchCategoriesFromSupabase } from '../utils/supabaseMarketplace';
import { doesTalentCityMatchFilter } from '../utils/cities';

interface BrowseTalentPageProps {
  initialActivity?: string;
  initialCity?: string;
  initialMode?: string;
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}

export const BrowseTalentPage: React.FC<BrowseTalentPageProps> = ({
  initialActivity = 'all',
  initialCity = 'Semua Kota',
  initialMode = 'all',
  onNavigate,
}) => {
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<string>(initialActivity);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedGender, setSelectedGender] = useState<GenderType>('Semua');
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);

  const loadMarketplaceData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [talentsData, categoriesData] = await Promise.all([
        fetchTalentsFromSupabase(),
        fetchCategoriesFromSupabase(),
      ]);
      setTalents(talentsData);
      setCategories(categoriesData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data marketplace dari Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  useEffect(() => {
    setSelectedActivity(initialActivity);
    setSelectedCity(initialCity);
    setSelectedMode(initialMode);
  }, [initialActivity, initialCity, initialMode]);

  const talentCities = useMemo(() => talents.map((t) => t.city), [talents]);

  const filteredTalents = useMemo(() => {
    return talents.filter((talent) => {
      // Activity filter
      if (
        selectedActivity !== 'all' &&
        !talent.activities.includes(selectedActivity as any)
      ) {
        return false;
      }

      // City filter
      if (!doesTalentCityMatchFilter(talent.city, selectedCity)) {
        return false;
      }

      // Gender filter
      if (selectedGender !== 'Semua' && talent.gender !== selectedGender) {
        return false;
      }

      // Mode filter
      if (selectedMode !== 'all') {
        if (selectedMode === 'online' && !talent.serviceMode?.includes('Online')) return false;
        if (selectedMode === 'offline' && !talent.serviceMode?.includes('Offline')) return false;
      }

      // Search query (name, headline, interests, bio)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = talent.name?.toLowerCase().includes(q) ?? false;
        const matchesHeadline = talent.headline?.toLowerCase().includes(q) ?? false;
        const matchesBio = talent.bio?.toLowerCase().includes(q) ?? false;
        const matchesInterests = talent.interests?.some((i) => i.toLowerCase().includes(q)) ?? false;
        if (!matchesName && !matchesHeadline && !matchesBio && !matchesInterests) {
          return false;
        }
      }

      return true;
    });
  }, [talents, selectedActivity, selectedCity, selectedGender, selectedMode, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActivity('all');
    setSelectedCity('Semua Kota');
    setSelectedGender('Semua');
    setSelectedMode('all');
  };

  return (
    <div className="min-h-screen py-5 sm:py-10 bg-[radial-gradient(ellipse_at_top,_rgba(233,213,255,0.42),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F4FC_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb / Title */}
        <div className="mb-5 sm:mb-8">
          <span className="inline-flex items-center rounded-full border border-purple-200/80 bg-white/75 px-3 py-1 text-[10px] font-bold text-purple-700 tracking-[0.16em] uppercase mb-3 shadow-sm backdrop-blur-md">
            {selectedMode === 'offline' ? 'Jasa Offline' : selectedMode === 'online' ? 'Jasa Online' : 'Katalog Sahabat Aktivitas'}
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#1E0938] tracking-tight drop-shadow-[0_2px_12px_rgba(76,29,149,0.08)]">
            {selectedMode === 'offline' ? 'Temukan Teman Offline' : selectedMode === 'online' ? 'Temukan Teman Online' : 'Jelajahi Talent YUKU'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {selectedMode === 'offline'
              ? 'Pilih teman untuk bertemu langsung dan menikmati aktivitas bersama.'
              : selectedMode === 'online'
                ? 'Pilih teman untuk mengobrol dan berinteraksi dari mana saja.'
                : 'Temukan teman untuk beraktivitas sosial, kulineran, olahraga, nonton bioskop, atau mengobrol santai.'}
          </p>
        </div>

        {/* Filter Bar Controls */}
        <div className="relative bg-white/85 p-3 sm:p-5 rounded-[26px] border border-white/90 shadow-[0_16px_42px_rgba(76,29,149,0.09),0_3px_12px_rgba(76,29,149,0.04)] ring-1 ring-purple-100/70 mb-5 sm:mb-8 space-y-3 sm:space-y-4 backdrop-blur-xl">
          {/* Row 1: Search & City & Reset */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, hobi (kopi, lari, seni), minat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-11 sm:min-h-0 pl-9 pr-4 py-2.5 text-base sm:text-sm bg-white/85 border border-white rounded-xl shadow-inner ring-1 ring-purple-100/80 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all"
              />
            </div>

            {/* Dynamic Regional Location Filter */}
            <div className="md:col-span-4">
              <LocationFilter
                selectedCity={selectedCity}
                talentCities={talentCities}
                onChangeCity={setSelectedCity}
              />
            </div>

            {/* Reset Button */}
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full md:w-auto min-h-11 sm:min-h-0 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-purple-800 bg-white/80 hover:bg-white border border-purple-100 shadow-sm hover:shadow rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            </div>
          </div>

          {/* Row 2: Activity Categories Buttons */}
          <div className="pt-3 sm:pt-4 border-t border-purple-100/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Kategori Aktivitas:
            </span>
            <div className="flex flex-nowrap overflow-x-auto pb-1.5 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedActivity('all')}
                className={`min-h-10 sm:min-h-0 px-3.5 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedActivity === 'all'
                    ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-md shadow-purple-300/40 ring-1 ring-white/30'
                    : 'bg-white/80 border border-purple-100 text-slate-700 hover:bg-purple-50 hover:border-purple-200 shadow-sm'
                }`}
              >
                Semua Aktivitas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedActivity(cat.id)}
                  className={`min-h-10 sm:min-h-0 px-3.5 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedActivity === cat.id
                      ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-md shadow-purple-300/40 ring-1 ring-white/30'
                      : 'bg-white/80 border border-purple-100 text-slate-700 hover:bg-purple-50 hover:border-purple-200 shadow-sm'
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Secondary Filters (Gender & Mode) */}
          <div className="pt-3 sm:pt-4 border-t border-purple-100/80 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs">
            {/* Gender Segmented */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-semibold text-slate-500">Gender:</span>
              <div className="inline-flex p-1 bg-white/70 border border-purple-100/80 shadow-inner rounded-full">
                {(['Semua', 'Wanita', 'Pria'] as GenderType[]).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setSelectedGender(gender)}
                    className={`min-h-10 sm:min-h-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                      selectedGender === gender
                        ? 'bg-white text-purple-900 shadow-md ring-1 ring-purple-100 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Mode */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-semibold text-slate-500">Metode:</span>
              <div className="inline-flex p-1 bg-white/70 border border-purple-100/80 shadow-inner rounded-full">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'offline', label: 'Offline' },
                  { id: 'online', label: 'Online' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedMode(mode.id)}
                    className={`min-h-10 sm:min-h-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                      selectedMode === mode.id
                        ? 'bg-white text-purple-900 shadow-md ring-1 ring-purple-100 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-slate-500 font-medium tabular-nums">
              Menampilkan <strong>{filteredTalents.length}</strong> Talent terverifikasi
            </div>
          </div>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 rounded-[28px] border border-white bg-white/70 shadow-[0_12px_34px_rgba(76,29,149,0.07)] animate-pulse" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-4 sm:p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadMarketplaceData}
              className="min-h-11 px-3 py-2 bg-rose-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-rose-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : filteredTalents.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
            {filteredTalents.map((talent) => (
              <TalentCard
                key={talent.id}
                talent={talent}
                priceMode={selectedMode === 'online' || selectedMode === 'offline' ? selectedMode : 'all'}
                onSelect={(id) => onNavigate('/talent/:id', { id })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 sm:py-16 bg-white/85 rounded-[28px] border border-white shadow-[0_16px_42px_rgba(76,29,149,0.08)] ring-1 ring-purple-100/70 p-5 sm:p-8 backdrop-blur-xl">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base mb-1">
              Tidak Ada Talent yang Sesuai Filter
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Coba ganti kategori aktivitas, pilih kota lain, atau reset filter untuk melihat seluruh profil.
            </p>
            <button
              onClick={handleResetFilters}
              className="min-h-11 px-4 py-2 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 transition-colors"
            >
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
