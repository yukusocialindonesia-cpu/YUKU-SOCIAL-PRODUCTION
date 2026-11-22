import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users, RotateCcw, AlertCircle, RefreshCw, Flame, MapPin, Wifi } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'hot' | 'nearby' | 'online'>('hot');

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
        if (!matchesName && !matchesHeadline && !matchesBio && !matchesInterests) {
          return false;
        }
      }

      return true;
    });
  }, [talents, selectedActivity, selectedCity, selectedGender, selectedMode, searchQuery, activeTab]);

  // Hot: prioritize verified profiles, then review volume and rating.
  const displayedTalents = useMemo(() => {
    if (activeTab !== 'hot') return filteredTalents;
    return [...filteredTalents].sort((a, b) => {
      const verifiedDifference = Number(b.isVerified === true) - Number(a.isVerified === true);
      if (verifiedDifference !== 0) return verifiedDifference;
      const reviewDifference = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      if (reviewDifference !== 0) return reviewDifference;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
  }, [filteredTalents, activeTab]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActivity('all');
    setSelectedCity('Semua Kota');
    setSelectedGender('Semua');
    setSelectedMode('all');
    setActiveTab('hot');
  };

  return (
    <div className="min-h-screen pb-28 sm:pb-10 pt-2 sm:pt-10 bg-[radial-gradient(ellipse_at_top,_rgba(233,213,255,0.42),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F4FC_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search & quick filters — mobile-first marketplace layout */}
        <section className="mb-5 sm:mb-7 space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari teman, aktivitas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari talent dan aktivitas"
              className="w-full h-12 sm:h-14 pl-12 pr-4 rounded-full bg-white/90 border border-purple-100 shadow-[0_8px_24px_rgba(76,29,149,0.09)] text-sm sm:text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-purple-50/80 p-1.5 border border-purple-100">
            {[
              { id: 'hot', label: 'Hot', icon: <Flame className="w-3.5 h-3.5" /> },
              { id: 'nearby', label: 'Terdekat', icon: <MapPin className="w-3.5 h-3.5" /> },
              { id: 'online', label: 'Online', icon: <Wifi className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  setSelectedMode('all');
                }}
                aria-pressed={activeTab === tab.id}
                className={`flex min-h-10 items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-purple-800 shadow-sm ring-1 ring-purple-100'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] text-slate-500">
              {activeTab === 'nearby' && selectedCity === 'Semua Kota'
                ? 'Pilih kota untuk melihat talent di sekitar.'
                : activeTab === 'hot'
                    ? 'Talent unggulan berdasarkan verifikasi, ulasan, dan rating.'
                    : 'Talent yang menyediakan layanan online.'}
            </span>
            <span className="shrink-0 text-[11px] sm:text-xs font-semibold text-slate-500 tabular-nums">
              {displayedTalents.length} talent
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <div className="min-w-0 w-full inline-flex items-center justify-between gap-2 rounded-full bg-white/90 border border-purple-100 px-3 py-2 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500">Gender</span>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value as GenderType)}
                aria-label="Filter gender"
                className="max-w-[92px] bg-transparent text-xs font-bold text-purple-900 outline-none"
              >
                <option value="Semua">Semua</option>
                <option value="Wanita">Wanita</option>
                <option value="Pria">Pria</option>
              </select>
            </div>
            <div className="min-w-0 w-full rounded-full bg-white/90 border border-purple-100 px-2 py-1.5 shadow-sm">
              <LocationFilter
                selectedCity={selectedCity}
                talentCities={talentCities}
                onChangeCity={setSelectedCity}
              />
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="col-span-2 sm:col-span-1 sm:ml-auto min-h-9 px-3 rounded-full bg-white/90 border border-purple-100 text-xs font-semibold text-slate-600 hover:text-purple-800 shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSelectedActivity('all')}
              aria-pressed={selectedActivity === 'all'}
              className={`shrink-0 min-h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap ${
                selectedActivity === 'all'
                  ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-200'
                  : 'bg-white/80 text-slate-600 border border-slate-200'
              }`}
            >
              Semua Kategori
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedActivity(cat.id)}
                aria-pressed={selectedActivity === cat.id}
                className={`shrink-0 min-h-9 px-4 rounded-full text-xs font-semibold whitespace-nowrap ${
                  selectedActivity === cat.id
                    ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-200'
                    : 'bg-white/80 text-slate-600 border border-slate-200'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </section>

        <div className="mb-5 sm:mb-8">
          <PromoCarousel
            compact
            promotions={promotions}
            isLoading={isLoadingPromotions}
            onNavigate={onNavigate}
          />
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
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
        ) : displayedTalents.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {displayedTalents.map((talent) => (
              <TalentCard
                key={talent.id}
                talent={talent}
                priceMode={activeTab === 'online' ? 'online' : selectedMode === 'online' || selectedMode === 'offline' ? selectedMode : 'all'}
                onSelect={(id) => onNavigate('/talent/:id', { id })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 sm:py-16 bg-white/85 rounded-[28px] border border-white shadow-[0_16px_42px_rgba(76,29,149,0.08)] ring-1 ring-purple-100/70 p-5 sm:p-8 backdrop-blur-xl">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base mb-1">
              {activeTab === 'nearby' && selectedCity === 'Semua Kota' ? 'Pilih Kota Terlebih Dahulu' : 'Tidak Ada Talent yang Sesuai Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {activeTab === 'nearby' && selectedCity === 'Semua Kota' ? 'Pilih kota pada filter lokasi. Untuk saat ini, pencarian terdekat menggunakan kota, bukan GPS.' : 'Coba ganti kategori aktivitas, pilih kota lain, atau reset filter untuk melihat seluruh profil.'}
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
