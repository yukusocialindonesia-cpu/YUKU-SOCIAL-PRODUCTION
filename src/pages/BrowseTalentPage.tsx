import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users, RotateCcw, AlertCircle, RefreshCw, SlidersHorizontal, Flame, Wifi, MapPin } from 'lucide-react';
import { TalentProfile, ActivityCategory, GenderType } from '../types/talent';
import { TalentCard } from '../components/talent/TalentCard';
import { LocationFilter } from '../components/talent/LocationFilter';
import { AppRoute } from '../types/navigation';
import { PromotionRow } from '../types/database';
import {
  fetchTalentsFromSupabase,
  fetchCategoriesFromSupabase,
  fetchPromotionsFromSupabase,
} from '../utils/supabaseMarketplace';
import { doesTalentCityMatchFilter } from '../utils/cities';

interface BrowseTalentPageProps {
  initialActivity?: string;
  initialCity?: string;
  initialMode?: string;
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}

interface ExploreBannerProps {
  promotion?: PromotionRow;
  position: 'top' | 'bottom';
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}

const ExploreBanner: React.FC<ExploreBannerProps> = ({ promotion, position, onNavigate }) => {
  const title = position === 'top' ? 'Temukan teman, ciptakan momen.' : 'Ada banyak momen seru menunggumu di YUKU.';
  const link = promotion?.link_url?.trim() || '';
  const isExternal = link.startsWith('https://') || link.startsWith('http://');
  const isInternal = link.startsWith('/');

  const fallback = (
    <div className={`flex h-[60px] items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 text-white shadow-[0_8px_22px_rgba(76,29,149,0.16)] ${position === 'top' ? 'bg-gradient-to-r from-[#42136B] via-[#7829C9] to-[#C04AD5]' : 'bg-gradient-to-r from-[#32134F] via-[#6331A8] to-[#A43CC1]'}`}>
      <div className="min-w-0">
        <p className="text-[12px] font-extrabold leading-tight sm:text-sm">{promotion?.title || title}</p>
        <p className="mt-1 text-[10px] text-white/85">{position === 'top' ? 'Jelajahi teman online dan offline' : 'Buka profil dan temukan aktivitas yang cocok'}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-purple-800">Jelajahi</span>
    </div>
  );

  if (!promotion?.image_url) return fallback;

  const image = (
    <img
      src={promotion.image_url}
      alt={promotion.title || 'Promosi YUKU'}
      className="h-[60px] w-full rounded-2xl bg-purple-950 object-cover shadow-[0_8px_22px_rgba(76,29,149,0.16)] sm:h-[76px]"
      loading={position === 'top' ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );

  if (isExternal) {
    return <a href={link} target="_blank" rel="noopener noreferrer" aria-label={promotion.title || 'Lihat promosi'} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">{image}</a>;
  }
  if (isInternal) {
    return <button type="button" onClick={() => onNavigate(link as AppRoute)} aria-label={promotion.title || 'Lihat promosi'} className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">{image}</button>;
  }
  return image;
};

export const BrowseTalentPage: React.FC<BrowseTalentPageProps> = ({
  initialActivity = 'all',
  initialCity = 'Semua Kota',
  initialMode = 'all',
  onNavigate,
}) => {
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<string>(initialActivity);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedGender, setSelectedGender] = useState<GenderType>('Semua');
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);
  const [showFilters, setShowFilters] = useState(false);

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

      // Promosi bersifat tambahan: kegagalan tabel promosi tidak boleh memblokir daftar talent.
      try {
        const promotionsData = await fetchPromotionsFromSupabase();
        setPromotions(promotionsData);
      } catch {
        setPromotions([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data Jelajah dari Supabase.');
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

  const talentCities = useMemo(() => talents.map((talent) => talent.city), [talents]);

  const filteredTalents = useMemo(() => talents.filter((talent) => {
    if (selectedActivity !== 'all' && !talent.activities.includes(selectedActivity as any)) return false;
    if (!doesTalentCityMatchFilter(talent.city, selectedCity)) return false;
    if (selectedGender !== 'Semua' && talent.gender !== selectedGender) return false;
    if (selectedMode === 'online' && !talent.serviceMode?.includes('Online')) return false;
    if (selectedMode === 'offline' && !talent.serviceMode?.includes('Offline')) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const matches = [
        talent.name,
        talent.headline,
        talent.bio,
        ...(talent.interests || []),
      ].some((value) => value?.toLowerCase().includes(query));
      if (!matches) return false;
    }
    return true;
  }), [talents, selectedActivity, selectedCity, selectedGender, selectedMode, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActivity('all');
    setSelectedCity('Semua Kota');
    setSelectedGender('Semua');
    setSelectedMode('all');
  };

  const firstFourTalents = filteredTalents.slice(0, 4);
  const remainingTalents = filteredTalents.slice(4);
  const topPromotion = promotions[0];
  const bottomPromotion = promotions[1];

  return (
    <div className="min-h-screen bg-[#FBF9FE] pb-3 pt-2 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-2.5 px-3 sm:space-y-5 sm:px-6 lg:px-8">
        {/* Search is intentionally the first content row under the existing global YUKU header. */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-700" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari teman, aktivitas..."
            aria-label="Cari teman atau aktivitas"
            className="h-10 w-full rounded-full border border-purple-100 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-[0_4px_16px_rgba(76,29,149,0.07)] outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 sm:h-12 sm:text-sm"
          />
        </div>

        {/* Compact discovery tabs. Online/offline use the existing marketplace filters. */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: 'all', label: 'Hot', icon: <Flame className="h-4 w-4" /> },
            { id: 'online', label: 'Online', icon: <Wifi className="h-4 w-4" /> },
            { id: 'offline', label: 'Offline', icon: <MapPin className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedMode(tab.id)}
              aria-pressed={selectedMode === tab.id}
              className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-bold transition ${selectedMode === tab.id ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-md shadow-purple-200' : 'text-slate-600 hover:bg-purple-50'}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
          <span className="ml-auto shrink-0 pr-1 text-[10px] font-semibold text-slate-400">{filteredTalents.length} talent</span>
        </div>

        {/* Small filter row; advanced controls stay tucked away until requested. */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <LocationFilter selectedCity={selectedCity} talentCities={talentCities} onChangeCity={setSelectedCity} />
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              aria-label="Buka filter lanjutan"
              className={`inline-flex h-[46px] items-center gap-2 rounded-2xl border px-3 text-xs font-bold shadow-sm transition ${showFilters || selectedActivity !== 'all' || selectedGender !== 'Semua' ? 'border-purple-300 bg-purple-50 text-purple-800' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filter
            </button>
            {showFilters && (
              <div className="absolute right-0 z-30 mt-2 w-[min(290px,calc(100vw-24px))] space-y-3 rounded-2xl border border-purple-100 bg-white p-4 shadow-xl">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
                  Gender
                  <select value={selectedGender} onChange={(event) => setSelectedGender(event.target.value as GenderType)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
                    <option value="Semua">Semua</option>
                    <option value="Wanita">Wanita</option>
                    <option value="Pria">Pria</option>
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
                  Kategori aktivitas
                  <select value={selectedActivity} onChange={(event) => setSelectedActivity(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
                    <option value="all">Semua aktivitas</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
                  </select>
                </label>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={handleResetFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-purple-700">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button type="button" onClick={() => setShowFilters(false)} className="rounded-full bg-purple-700 px-4 py-2 text-xs font-bold text-white">Terapkan</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* First promotional banner: active content from the existing promotions table. */}
        <ExploreBanner promotion={topPromotion} position="top" onNavigate={onNavigate} />

        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-[clamp(132px,19vh,164px)] animate-pulse rounded-[18px] bg-purple-100" />)}
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-800">
            <AlertCircle className="h-6 w-6" />
            <p>{errorMsg}</p>
            <button type="button" onClick={loadMarketplaceData} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white">
              <RefreshCw className="h-4 w-4" /> Coba lagi
            </button>
          </div>
        ) : filteredTalents.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-5">
              {firstFourTalents.map((talent) => (
                <TalentCard
                  key={talent.id}
                  talent={talent}
                  compact
                  showPrice={false}
                  priceMode={selectedMode === 'online' || selectedMode === 'offline' ? selectedMode : 'all'}
                  onSelect={(id) => onNavigate('/talent/:id', { id })}
                />
              ))}
            </div>

            {/* Second banner follows the first four talent photos in the initial mobile viewport. */}
            <ExploreBanner promotion={bottomPromotion} position="bottom" onNavigate={onNavigate} />

            {remainingTalents.length > 0 && (
              <section className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-[#32134F] sm:text-lg">Temukan lebih banyak teman</h2>
                  <span className="text-[10px] font-medium text-slate-400">{remainingTalents.length} lainnya</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-5">
                  {remainingTalents.map((talent) => (
                    <TalentCard
                      key={talent.id}
                      talent={talent}
                      compact
                      showPrice={false}
                      priceMode={selectedMode === 'online' || selectedMode === 'offline' ? selectedMode : 'all'}
                      onSelect={(id) => onNavigate('/talent/:id', { id })}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-purple-100 bg-white px-5 py-9 text-center shadow-sm">
              <Users className="mx-auto mb-3 h-10 w-10 text-purple-300" />
              <h2 className="text-sm font-bold text-slate-800">Belum ada talent yang cocok</h2>
              <p className="mt-1 text-xs text-slate-500">Coba ubah kata pencarian atau filter yang dipilih.</p>
              <button type="button" onClick={handleResetFilters} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-purple-700 px-4 text-xs font-bold text-white">
                <RotateCcw className="h-3.5 w-3.5" /> Reset filter
              </button>
            </div>
            <ExploreBanner promotion={bottomPromotion} position="bottom" onNavigate={onNavigate} />
          </>
        )}
      </div>
    </div>
  );
};
