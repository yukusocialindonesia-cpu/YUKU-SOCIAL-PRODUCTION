import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users, RotateCcw, AlertCircle, RefreshCw, MapPin, Wifi, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { TalentProfile, ActivityCategory, GenderType } from '../types/talent';
import { TalentCard } from '../components/talent/TalentCard';
import { LocationFilter } from '../components/talent/LocationFilter';
import { PromoCarousel } from '../components/home/PromoCarousel';
import { AppRoute } from '../types/navigation';
import { PromotionRow } from '../types/database';
import { fetchTalentsFromSupabase, fetchCategoriesFromSupabase, fetchPromotionsFromSupabase } from '../utils/supabaseMarketplace';
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
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<string>(initialActivity);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedGender, setSelectedGender] = useState<GenderType>('Semua');
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);
  const [activeTab, setActiveTab] = useState<'hot' | 'nearby' | 'online' | 'favorites'>('hot');
  const [favoriteTalentIds, setFavoriteTalentIds] = useState<Set<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    let isMounted = true;
    async function loadPromotions() {
      try {
        const data = await fetchPromotionsFromSupabase();
        if (isMounted) setPromotions(data);
      } catch {
        if (isMounted) setPromotions([]);
      } finally {
        if (isMounted) setIsLoadingPromotions(false);
      }
    }
    loadPromotions();
    return () => { isMounted = false; };
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

      // Discovery tab filters
      if (activeTab === 'online' && !talent.serviceMode?.includes('Online')) return false;
      if (activeTab === 'favorites' && !favoriteTalentIds.has(talent.id)) return false;
      if (activeTab === 'nearby' && selectedCity === 'Semua Kota') return false;

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
        const matchesActivities = talent.activities?.some((activity) => activity.toLowerCase().includes(q)) ?? false;
        if (!matchesName && !matchesHeadline && !matchesBio && !matchesInterests && !matchesActivities) {
          return false;
        }
      }

      return true;
    });
  }, [talents, selectedActivity, selectedCity, selectedGender, selectedMode, searchQuery, activeTab, favoriteTalentIds]);

  const displayedTalents = useMemo(() => {
    if (activeTab !== 'hot') return filteredTalents;
    return [...filteredTalents].sort((a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
    );
  }, [filteredTalents, activeTab]);

  const toggleFavorite = (talentId: string) => {
    setFavoriteTalentIds((current) => {
      const next = new Set(current);
      if (next.has(talentId)) next.delete(talentId);
      else next.add(talentId);
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActivity('all');
    setSelectedCity('Semua Kota');
    setSelectedGender('Semua');
    setSelectedMode('all');
    setActiveTab('hot');
  };

  return (
    <div className="min-h-screen pb-28 sm:pb-10 pt-3 sm:pt-10 bg-[radial-gradient(ellipse_at_top,_rgba(233,213,255,0.42),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F4FC_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search, tabs, and quick activity filters */}
        <section className="mb-3 space-y-3 sm:mb-5 sm:space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari aktivitas, kota, atau teman..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari aktivitas, kota, atau teman"
              className="h-12 w-full rounded-full border border-purple-100 bg-slate-100/90 pl-11 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div role="tablist" aria-label="Mode pencarian" className="flex h-9 items-stretch gap-6 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'hot', label: 'Hot' },
              { id: 'nearby', label: 'Terdekat' },
              { id: 'online', label: 'Online' },
              { id: 'favorites', label: 'Favorit' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  setSelectedMode('all');
                }}
                className={`relative h-9 shrink-0 px-0.5 text-xs font-bold transition-colors ${activeTab === tab.id ? 'text-purple-800' : 'text-slate-500 hover:text-purple-700'}`}
              >
                {tab.label}
                {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-purple-700" />}
              </button>
            ))}
          </div>

          <div className="flex h-8 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {['Semua', 'Jakarta', 'Ngopi', 'Jalan Sore', 'Mabar'].map((label) => {
              const category = categories.find((item) => item.title.toLowerCase() === label.toLowerCase());
              const isActive = label === 'Semua'
                ? selectedActivity === 'all' && selectedCity === 'Semua Kota'
                : label === 'Jakarta'
                  ? selectedCity.toLowerCase() === 'jakarta'
                  : Boolean(category && selectedActivity === category.id);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    if (label === 'Semua') {
                      setSelectedActivity('all');
                      setSelectedCity('Semua Kota');
                    } else if (label === 'Jakarta') {
                      setSelectedCity('Jakarta');
                    } else if (category) {
                      setSelectedActivity(category.id);
                    } else {
                      setSearchQuery(label);
                    }
                  }}
                  className={`h-8 shrink-0 rounded-full px-3.5 text-[11px] font-semibold transition-colors ${isActive ? 'bg-purple-700 text-white shadow-sm' : 'border border-purple-100 bg-white text-slate-600 hover:border-purple-200 hover:text-purple-800'}`}
                >
                  {label}
                </button>
              );
            })}
            <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="browse-advanced-filters" className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-purple-100 bg-white px-3 text-[11px] font-semibold text-purple-800 sm:hidden">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div id="browse-advanced-filters" className={`${filtersOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 gap-2 sm:gap-3`}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1 sm:flex sm:items-center">
              <div className="min-w-0 w-full inline-flex items-center justify-between gap-2 rounded-full bg-white/90 border border-purple-100 px-3 py-2 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500">Gender</span>
                <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value as GenderType)} aria-label="Filter gender" className="max-w-[92px] bg-transparent text-xs font-bold text-purple-900 outline-none">
                  <option value="Semua">Semua</option><option value="Wanita">Wanita</option><option value="Pria">Pria</option>
                </select>
              </div>
              <div className="min-w-0 w-full rounded-full bg-white/90 border border-purple-100 px-2 py-1.5 shadow-sm">
                <LocationFilter selectedCity={selectedCity} talentCities={talentCities} onChangeCity={setSelectedCity} />
              </div>
              <button type="button" onClick={handleResetFilters} className="min-h-9 px-2 sm:px-3 rounded-full bg-white/90 border border-purple-100 text-[11px] sm:text-xs font-semibold text-slate-600 hover:text-purple-800 shadow-sm inline-flex items-center justify-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>
        </section>

        {/* Promo banner follows search, tabs, and quick filters on Jelajahi. */}
        <div className="mb-3 sm:mb-5">
          <PromoCarousel
            compact
            promotions={promotions}
            isLoading={isLoadingPromotions}
            onNavigate={onNavigate}
          />
        </div>

        {/* Main talent directory */}
        <section className="mb-2 sm:mb-4" aria-labelledby="browse-talent-heading">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id="browse-talent-heading" className="text-lg font-bold tracking-tight text-slate-900">
                Jelajahi Aktivitas
              </h2>
              <p className="hidden sm:block mt-0.5 text-sm text-slate-500">
                Kenali talent dan pilih teman untuk aktivitasmu.
              </p>
            </div>
            <button type="button" onClick={() => { setSelectedActivity('all'); setSelectedCity('Semua Kota'); setActiveTab('offline'); }} className="shrink-0 text-xs font-bold text-purple-700 hover:text-purple-900">Lihat Semua</button>
          </div>
        </section>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-[repeat(2,minmax(0,171px))] justify-start gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 xl:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 sm:h-80 rounded-[28px] border border-white bg-white/70 shadow-[0_12px_34px_rgba(76,29,149,0.07)] animate-pulse" />
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
        ) : displayedTalents.length > 0 ? (
          <div className="grid grid-cols-[repeat(2,minmax(0,171px))] justify-start gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 xl:gap-5">
            {displayedTalents.map((talent) => (
              <TalentCard
                key={talent.id}
                talent={talent}
                priceMode={activeTab === 'online' ? 'online' : selectedMode === 'online' || selectedMode === 'offline' ? selectedMode : 'all'}
                showPrice={true}
                isFavorite={favoriteTalentIds.has(talent.id)}
                onToggleFavorite={toggleFavorite}
                onSelect={(id) => onNavigate('/talent/:id', { id })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 sm:py-16 bg-white/85 rounded-[28px] border border-white shadow-[0_16px_42px_rgba(76,29,149,0.08)] ring-1 ring-purple-100/70 p-5 sm:p-8 backdrop-blur-xl">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base mb-1">
              {activeTab === 'nearby' && selectedCity === 'Semua Kota' ? 'Pilih Kota Terlebih Dahulu' : activeTab === 'favorites' ? 'Belum Ada Talent Favorit' : 'Tidak Ada Talent yang Sesuai Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {activeTab === 'nearby' && selectedCity === 'Semua Kota' ? 'Pilih kota pada filter lokasi. Untuk saat ini, pencarian terdekat menggunakan kota, bukan GPS.' : activeTab === 'favorites' ? 'Tekan ikon hati pada kartu talent untuk menyimpan profil favorit di sesi ini.' : 'Coba ganti kategori aktivitas, pilih kota lain, atau reset filter untuk melihat seluruh profil.'}
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
