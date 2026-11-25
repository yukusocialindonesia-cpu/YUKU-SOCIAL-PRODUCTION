import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Users, RotateCcw, AlertCircle, RefreshCw, SlidersHorizontal, MapPin, Flame, ChevronDown, Activity, CalendarDays, Music2, Heart, Utensils, Dumbbell, Gamepad2, Sparkles, Star } from 'lucide-react';
import { TalentProfile, ActivityCategory, GenderType } from '../types/talent';
import { TalentCard } from '../components/talent/TalentCard';
import { LocationFilter } from '../components/talent/LocationFilter';
import { AppRoute } from '../types/navigation';
import { fetchTalentsFromSupabase, fetchTalentsByIdsFromSupabase, fetchCategoriesFromSupabase, fetchPromotionsFromSupabase } from '../utils/supabaseMarketplace';
import type { PromotionRow } from '../types/database';
import { doesTalentCityMatchFilter } from '../utils/cities';
import { useAuth } from '../contexts/AuthContext';

const getCreatedAtTimestamp = (createdAt?: string) => {
  const timestamp = Date.parse(createdAt || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const PromotionBannerVisual: React.FC<{ imageUrl: string; title: string }> = ({ imageUrl, title }) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed || !imageUrl) {
    return (
      <div
        role="img"
        aria-label={`Gambar promosi ${title} tidak tersedia`}
        className="flex min-h-24 w-full items-center justify-center bg-gradient-to-r from-purple-950 via-purple-900 to-fuchsia-900 px-5 py-6 text-center text-white sm:min-h-32"
      >
        <div>
          <p className="text-sm font-extrabold tracking-wide">YUKU</p>
          <p className="mt-1 text-xs text-purple-100">Informasi promosi belum dapat ditampilkan.</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={title || 'Promosi YUKU'}
      loading="eager"
      decoding="async"
      onError={() => setImageFailed(true)}
      className="block h-auto w-full"
    />
  );
};

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
  const { user } = useAuth();
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [hasMoreTalents, setHasMoreTalents] = useState(false);
  const [loadingMoreTalents, setLoadingMoreTalents] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [visibleTalentCount, setVisibleTalentCount] = useState(12);
  const nextTalentOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const searchRequestRef = useRef(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [activePromotionIndex, setActivePromotionIndex] = useState(0);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const activeSearchQueryRef = useRef(searchQuery);

  useEffect(() => {
    activeSearchQueryRef.current = searchQuery;
  }, [searchQuery]);
  const [selectedActivity, setSelectedActivity] = useState<string>(initialActivity);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedGender, setSelectedGender] = useState<GenderType>('Semua');
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);
  const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [nearestTalentDistances, setNearestTalentDistances] = useState<Record<string, number> | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');

  const handleUseMyLocation = () => {
    // A failed or denied new GPS attempt must not leave an older location active.
    setCustomerLocation(null);
    setNearestTalentDistances(null);

    if (!window.isSecureContext || !navigator.geolocation) {
      setGpsLoading(false);
      setGpsMessage('GPS memerlukan browser yang mendukung lokasi dan koneksi aman (HTTPS).');
      return;
    }

    setGpsLoading(true);
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCustomerLocation(nextLocation);
        setNearestTalentDistances(null);
        void (async () => {
          try {
            const { data, error } = await (await import('../lib/supabase')).supabase.rpc('find_nearest_talents', {
              p_customer_latitude: nextLocation.latitude,
              p_customer_longitude: nextLocation.longitude,
              p_limit: 500,
            });
            if (error) throw error;
            const distances = Object.fromEntries(
              ((data || []) as Array<{ talent_id: string; distance_km: number }>).map((item) => [item.talent_id, Number(item.distance_km)])
            );
            setNearestTalentDistances(distances);

            // The marketplace loader reacts to this distance map and fetches
            // matching profiles by ID together with the current search query.
            setGpsMessage(Object.keys(distances).length
              ? 'Talent di sekitar Anda sudah diurutkan berdasarkan jarak perkiraan.'
              : 'Belum ada Talent aktif dalam radius layanan. Anda tetap bisa mencari berdasarkan kota.');
          } catch (error: any) {
            setNearestTalentDistances(null);
            setGpsMessage(error?.message || 'Pencarian jarak belum tersedia. Anda tetap bisa mencari berdasarkan kota.');
          } finally {
            setGpsLoading(false);
          }
        })();
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Kamu tetap bisa memilih kota secara manual.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Lokasi belum dapat ditemukan. Coba lagi atau pilih kota secara manual.'
            : 'Permintaan lokasi terlalu lama. Coba lagi.';
        setGpsMessage(message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 }
    );
  };

  const TALENT_BATCH_SIZE = 100;
  const TALENT_DISPLAY_STEP = 12;

  const loadMarketplaceData = async (searchTerm = searchQuery) => {
    const requestId = ++searchRequestRef.current;
    setLoading(true);
    setErrorMsg(null);
    setLoadMoreError(null);
    // Invalidate any pagination request started for the previous search/filter state.
    loadingMoreRef.current = false;
    setLoadingMoreTalents(false);
    setVisibleTalentCount(TALENT_DISPLAY_STEP);
    // Pertahankan kartu yang sudah tampil selama pencarian/filter berikutnya berjalan.
    // Hasil baru akan menggantikan daftar lama setelah request terbaru berhasil.
    setHasMoreTalents(false);
    nextTalentOffsetRef.current = 0;
    try {
      const nearbyIds = nearestTalentDistances ? Object.keys(nearestTalentDistances) : [];
      const [talentsResult, categoriesResult, nearbyTalentsResult] = await Promise.allSettled([
        fetchTalentsFromSupabase(TALENT_BATCH_SIZE, 0, searchTerm),
        fetchCategoriesFromSupabase(),
        nearbyIds.length > 0
          ? fetchTalentsByIdsFromSupabase(nearbyIds, searchTerm)
          : Promise.resolve([] as TalentProfile[]),
      ]);

      if (requestId !== searchRequestRef.current) return;
      if (talentsResult.status === 'rejected') {
        throw talentsResult.reason;
      }

      const mergedTalents = new Map(talentsResult.value.map((talent) => [talent.id, talent]));
      if (nearbyTalentsResult.status === 'fulfilled') {
        nearbyTalentsResult.value.forEach((talent) => mergedTalents.set(talent.id, talent));
      } else {
        console.warn('Talent terdekat berdasarkan GPS tidak dapat dimuat ulang:', nearbyTalentsResult.reason);
      }
      setTalents([...mergedTalents.values()]);
      nextTalentOffsetRef.current = talentsResult.value.length;
      setHasMoreTalents(talentsResult.value.length === TALENT_BATCH_SIZE);
      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value);
      } else {
        console.warn('Kategori aktivitas Jelajah tidak dapat dimuat:', categoriesResult.reason);
        setCategories([]);
      }
    } catch (err: any) {
      if (requestId === searchRequestRef.current) {
        setErrorMsg(err.message || 'Gagal memuat data marketplace dari Supabase.');
      }
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Invalidate in-flight pagination immediately, including during the search debounce.
    searchRequestRef.current += 1;
    const timer = window.setTimeout(() => {
      void loadMarketplaceData(searchQuery);
    }, searchQuery.trim() ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery, nearestTalentDistances]);

  const loadNextTalentBatch = async () => {
    if (loadingMoreRef.current || !hasMoreTalents) return;

    loadingMoreRef.current = true;
    setLoadingMoreTalents(true);
    setLoadMoreError(null);
    const requestId = searchRequestRef.current;
    const requestedSearch = searchQuery;
    try {
      const offset = nextTalentOffsetRef.current;
      const nextBatch = await fetchTalentsFromSupabase(TALENT_BATCH_SIZE, offset, requestedSearch);
      // Ignore a page response if the user has since started a new search.
      if (requestId !== searchRequestRef.current || requestedSearch !== activeSearchQueryRef.current) return;
      if (nextBatch.length > 0) {
        setTalents((current) => {
          const existingIds = new Set(current.map((talent) => talent.id));
          return [...current, ...nextBatch.filter((talent) => !existingIds.has(talent.id))];
        });
        nextTalentOffsetRef.current = offset + nextBatch.length;
      }
      setHasMoreTalents(nextBatch.length === TALENT_BATCH_SIZE);
    } catch (error: any) {
      if (requestId !== searchRequestRef.current || requestedSearch !== activeSearchQueryRef.current) return;
      console.warn('Batch Talent berikutnya gagal dimuat:', error);
      setLoadMoreError(error?.message || 'Talent berikutnya gagal dimuat.');
    } finally {
      // An outdated request must not clear the loading state of a newer request.
      if (requestId === searchRequestRef.current) {
        loadingMoreRef.current = false;
        setLoadingMoreTalents(false);
      }
    }
  };

  // Promosi dimuat terpisah agar gangguan tabel promosi tidak menghambat katalog Talent.
  useEffect(() => {
    let isMounted = true;
    fetchPromotionsFromSupabase()
      .then((items) => {
        if (isMounted) setPromotions(items);
      })
      .catch((error) => {
        console.warn('Promosi Jelajah tidak dapat dimuat:', error);
        if (isMounted) setPromotions([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (promotions.length < 2) {
      setActivePromotionIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setActivePromotionIndex((current) => (current + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [promotions.length]);

  useEffect(() => {
    setSelectedActivity(initialActivity);
    setSelectedCity(initialCity);
    setSelectedMode(initialMode);
  }, [initialActivity, initialCity, initialMode]);

  const talentCities = useMemo(() => talents.map((t) => t.city), [talents]);

  const filteredTalents = useMemo(() => {
    return talents.filter((talent) => {
      // Do not show the signed-in account's own profile in its discovery results.
      if (user?.id && talent.id === user.id) return false;

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

      // GPS is a meeting-distance filter only for offline-capable Talent.
      // If no nearby result exists, preserve the normal city-based discovery fallback.
      const hasNearbyResults = Boolean(nearestTalentDistances && Object.keys(nearestTalentDistances).length > 0);
      if (
        customerLocation &&
        hasNearbyResults &&
        selectedMode !== 'online' &&
        talent.serviceMode !== 'Online Only' &&
        nearestTalentDistances?.[talent.id] == null
      ) return false;
      return true;
    }).sort((a, b) => {
      if (!customerLocation || !nearestTalentDistances || selectedMode === 'online' || Object.keys(nearestTalentDistances).length === 0) return 0;
      const distanceA = a.serviceMode === 'Online Only' ? Number.POSITIVE_INFINITY : (nearestTalentDistances[a.id] ?? Number.POSITIVE_INFINITY);
      const distanceB = b.serviceMode === 'Online Only' ? Number.POSITIVE_INFINITY : (nearestTalentDistances[b.id] ?? Number.POSITIVE_INFINITY);
      return distanceA - distanceB;
    }).map((talent) => ({
      ...talent,
      distanceKm: customerLocation && nearestTalentDistances && selectedMode !== 'online' && talent.serviceMode !== 'Online Only'
        ? nearestTalentDistances[talent.id]
        : undefined,
    }));
  }, [talents, user?.id, selectedActivity, selectedCity, selectedGender, selectedMode, searchQuery, customerLocation, nearestTalentDistances]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || loading || loadingMoreTalents || loadMoreError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (visibleTalentCount < filteredTalents.length) {
          setVisibleTalentCount((current) => current + TALENT_DISPLAY_STEP);
        } else if (hasMoreTalents) {
          void loadNextTalentBatch();
        }
      },
      { rootMargin: '500px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMoreTalents, loadMoreError, visibleTalentCount, filteredTalents.length, hasMoreTalents, talents.length]);

  // Setiap perubahan filter memulai kembali tampilan dari 12 kartu pertama.
  useEffect(() => {
    setVisibleTalentCount(TALENT_DISPLAY_STEP);
  }, [selectedActivity, selectedCity, selectedGender, selectedMode, searchQuery]);

  const displayTalents = useMemo(() => {
    const items = [...filteredTalents];
    if (customerLocation && nearestTalentDistances && selectedMode !== 'online' && Object.keys(nearestTalentDistances).length > 0) return items;
    return items.sort((a, b) => {
      if (sortBy === 'newest') return getCreatedAtTimestamp(b.createdAt) - getCreatedAtTimestamp(a.createdAt);
      if (sortBy === 'popular') return (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0);
      return (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });
  }, [filteredTalents, sortBy, customerLocation, nearestTalentDistances, selectedMode]);

  const getActivityIcon = (category: ActivityCategory) => {
    const key = `${category.iconName} ${category.title}`.toLowerCase();
    if (/run|sport|olahraga|fitness|gym/.test(key)) return <Dumbbell className="h-4 w-4" />;
    if (/event|calendar|acara|meeting/.test(key)) return <CalendarDays className="h-4 w-4" />;
    if (/music|musik|karaoke|hiburan/.test(key)) return <Music2 className="h-4 w-4" />;
    if (/food|kuliner|makan|coffee|kopi/.test(key)) return <Utensils className="h-4 w-4" />;
    if (/game|gaming|permainan/.test(key)) return <Gamepad2 className="h-4 w-4" />;
    if (/social|sosial|friend|teman|heart/.test(key)) return <Heart className="h-4 w-4" />;
    if (/activity|aktivitas/.test(key)) return <Activity className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  };

  const hasAdvancedFilters = selectedActivity !== 'all' || selectedCity !== 'Semua Kota' || selectedGender !== 'Semua' || selectedMode !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActivity('all');
    setSelectedCity('Semua Kota');
    setSelectedGender('Semua');
    setSelectedMode('all');
  };

  // Seluruh hasil Jelajah memakai satu pola kartu agar konsisten saat pengguna scroll.

  return (
    <div className="min-h-screen py-0 sm:py-10 bg-[radial-gradient(ellipse_at_top,_rgba(216,180,254,0.38),_transparent_48%),linear-gradient(180deg,#F8F3FF_0%,#F2ECFA_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Jelajah */}
        <section className="hidden sm:block relative mb-2 sm:mb-7 overflow-hidden rounded-2xl sm:rounded-[26px] border border-purple-100/80 bg-white/75 px-3 py-2 sm:px-7 sm:py-6 shadow-[0_10px_30px_rgba(76,29,149,0.06)] backdrop-blur-sm">
          <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-purple-200/30 blur-3xl" />
          <div className="relative max-w-3xl">
            <span className="hidden sm:inline-flex items-center rounded-full border border-purple-200/80 bg-white/90 px-3 py-1 text-[9px] sm:text-[10px] font-bold text-purple-700 tracking-[0.16em] uppercase mb-2.5 shadow-sm">
              {selectedMode === 'offline' ? 'Jasa Offline' : selectedMode === 'online' ? 'Jasa Online' : 'Katalog Sahabat Aktivitas'}
            </span>
            <h1 className="text-lg leading-tight sm:text-4xl font-extrabold text-[#1E0938] tracking-tight">
              {selectedMode === 'offline' ? 'Temukan Teman Offline' : selectedMode === 'online' ? 'Temukan Teman Online' : 'Jelajahi Talent YUKU'}
            </h1>
            <p className="hidden sm:block mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              {selectedMode === 'offline'
                ? 'Pilih teman untuk bertemu langsung dan menikmati aktivitas bersama.'
                : selectedMode === 'online'
                  ? 'Pilih teman untuk mengobrol dan berinteraksi dari mana saja.'
                  : 'Temukan teman untuk beraktivitas sosial, kulineran, olahraga, nonton bioskop, atau mengobrol santai.'}
            </p>
          </div>
        </section>

        {/* Satu banner promosi tampil bergantian otomatis; katalog tetap aman jika promosi kosong. */}
        {promotions.length > 0 && (
          <section aria-label="Promosi YUKU" className="mb-3 sm:mb-7">
            {(() => {
              const promotion = promotions[activePromotionIndex] || promotions[0];
              const safeLink = promotion.link_url?.trim() || '';
              const canNavigate = /^(https?:\/\/|\/(?!\/)|#)/i.test(safeLink);
              return (
                <div className="relative w-full overflow-hidden rounded-2xl border border-purple-100 bg-purple-950 shadow-[0_10px_28px_rgba(76,29,149,0.14)]">
                  <div className="relative w-full bg-purple-950">
                    <PromotionBannerVisual
                      key={promotion.id}
                      imageUrl={promotion.image_url}
                      title={promotion.title || 'Promosi YUKU'}
                    />
                    {canNavigate && (
                      <a
                        href={safeLink}
                        aria-label={`Lihat promosi: ${promotion.title || 'YUKU'}`}
                        className="absolute inset-0 z-[5] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                      />
                    )}
                    {promotions.length > 1 && (
                      <>
                        <div className="absolute bottom-2 right-3 z-20 flex items-center gap-1.5 sm:bottom-3 sm:right-5">
                          {promotions.map((item, index) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActivePromotionIndex(index)}
                              aria-label={`Tampilkan promosi ${index + 1}`}
                              aria-current={index === activePromotionIndex ? 'true' : undefined}
                              className={`h-1.5 rounded-full transition-all ${index === activePromotionIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/60 hover:bg-white'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        <div className="sticky top-[68px] min-[431px]:top-[72px] lg:top-[76px] xl:static z-30 -mx-4 bg-[#F8F3FF]/95 px-4 pb-2 pt-2 backdrop-blur-md sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-none">
        {/* Filter Bar Controls */}
        <div className="relative bg-white/95 p-2 sm:p-4 rounded-2xl sm:rounded-[26px] border border-purple-100/80 shadow-[0_8px_22px_rgba(76,29,149,0.07)] ring-1 ring-white/80 mb-2 sm:mb-6 space-y-2 sm:space-y-3 backdrop-blur-none sm:backdrop-blur-xl">
          {/* Row 1: Search & City & Reset */}
          <div className="grid grid-cols-12 md:grid-cols-12 gap-2.5 sm:gap-3">
            {/* Search and city selector share one pill, matching the mobile reference */}
            <div className="col-span-10 md:col-span-9 flex min-w-0 items-center overflow-visible rounded-full border border-slate-200/80 bg-white shadow-sm">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 sm:left-4" />
                <input
                  type="text"
                  placeholder="Cari talent..."
                  aria-label="Cari talent berdasarkan nama atau minat"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full min-w-0 rounded-l-full border-0 bg-transparent py-2 pl-9 pr-2 text-[13px] shadow-none transition-all placeholder:text-slate-400 focus:outline-none focus:ring-0 sm:h-11 sm:pl-11 sm:text-sm"
                />
              </div>
              <div className="h-7 w-px shrink-0 bg-slate-200" />
              <div className="relative min-w-0 flex-1">
                <LocationFilter
                  selectedCity={selectedCity}
                  talentCities={talentCities}
                  onChangeCity={setSelectedCity}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMoreFilters((open) => !open)}
              aria-expanded={showMoreFilters}
              aria-controls="jelajah-advanced-filters"
              aria-label={showMoreFilters ? "Tutup filter lainnya" : hasAdvancedFilters ? "Buka filter lainnya, ada filter aktif" : "Buka filter lainnya"}
              title={showMoreFilters ? "Tutup filter" : "Filter lainnya"}
              className="relative col-span-2 md:hidden min-h-11 inline-flex items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-1 text-purple-800 shadow-sm transition-colors active:bg-purple-100"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only">Filter tambahan</span>
              {hasAdvancedFilters && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-fuchsia-600 ring-2 ring-purple-50" />}
            </button>

            {/* Reset Button */}
            <div className="hidden md:flex md:col-span-3 items-center justify-end">
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

          <div id="jelajah-advanced-filters" className={`${showMoreFilters ? "block" : "hidden"} md:block space-y-1.5 sm:space-y-4`}>
          <div className="rounded-xl border border-purple-100 bg-purple-50/70 p-2 sm:p-3">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={gpsLoading}
              aria-label="Gunakan lokasi GPS saya"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-purple-800 transition-colors hover:bg-purple-100 disabled:cursor-wait disabled:opacity-60"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              {gpsLoading ? 'Mencari lokasi...' : customerLocation ? 'Lokasi Saya Aktif' : 'Gunakan Lokasi Saya'}
            </button>
            {gpsMessage && (
              <p role="status" aria-live="polite" className="mt-1 text-center text-[10px] leading-snug text-slate-600 sm:text-xs">
                {gpsMessage}
              </p>
            )}
          </div>
          {/* Row 2: Activity Categories Buttons */}
          <div className="hidden sm:block pt-2 sm:pt-4 border-t border-purple-100/80">
            <div className="flex flex-nowrap overflow-x-auto pb-1.5 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedActivity('all')}
                className={`min-h-11 sm:min-h-0 px-3.5 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
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
                  className={`min-h-11 sm:min-h-0 px-3.5 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedActivity === cat.id
                      ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-md shadow-purple-300/40 ring-1 ring-white/30'
                      : 'bg-white/80 border border-purple-100 text-slate-700 hover:bg-purple-50 hover:border-purple-200 shadow-sm'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">{getActivityIcon(cat)}{cat.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Secondary Filters (Gender & Mode) */}
          <div className="pt-2 sm:pt-4 border-t border-purple-100/80 flex flex-wrap items-center justify-between gap-1.5 sm:gap-4 text-xs">
            {/* Gender Segmented */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-semibold text-slate-500">Gender:</span>
              <div className="inline-flex p-1 bg-white/70 border border-purple-100/80 shadow-inner rounded-full">
                {(['Semua', 'Wanita', 'Pria'] as GenderType[]).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setSelectedGender(gender)}
                    className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
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
                    className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
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
              Menampilkan <strong>{filteredTalents.length}</strong> Talent
            </div>
          </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="md:hidden min-h-11 w-full rounded-xl border border-purple-100 bg-white px-3 text-[11px] font-semibold text-slate-600"
            >
              Reset semua filter
            </button>
          </div>
        </div>

        {/* Jenis aktivitas ditampilkan langsung di bawah pencarian pada mobile. */}
        <section aria-label="Pilih jenis aktivitas" className="sm:hidden mb-3 -mx-1">
          <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSelectedActivity('all')}
              aria-pressed={selectedActivity === 'all'}
              className={`min-h-10 shrink-0 rounded-full px-3.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${selectedActivity === 'all' ? 'bg-purple-700 text-white shadow-sm' : 'border border-purple-100 bg-white text-slate-700'}`}
            >
              <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-current" />Semua</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedActivity(cat.id)}
                aria-pressed={selectedActivity === cat.id}
                className={`min-h-11 shrink-0 rounded-full px-4 text-[11px] font-semibold whitespace-nowrap transition-colors ${selectedActivity === cat.id ? 'bg-purple-700 text-white shadow-sm' : 'border border-purple-100 bg-white text-slate-700'}`}
              >
                <span className="inline-flex items-center gap-1.5">{getActivityIcon(cat)}{cat.title}</span>
              </button>
            ))}
          </div>
        </section>
        </div>

        {/* Judul ringkas khusus mobile, tepat sebelum kartu talent */}
        <div className="sm:hidden mb-3 flex items-center justify-between border-b border-purple-100/80 pb-2">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-[#32134F]"><Flame className="h-4 w-4 fill-orange-500 text-orange-500" />Jelajahi Talent</h2>
          <label className="relative inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700">
            <Flame className="h-3.5 w-3.5 fill-purple-600 text-purple-600" />
            <select aria-label="Urutkan talent" value={sortBy} onChange={(event) => setSortBy(event.target.value as 'popular' | 'rating' | 'newest')} className="min-h-9 appearance-none rounded-full border border-purple-100 bg-white py-1 pl-2 pr-6 text-[10px] font-semibold text-purple-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-200">
              <option value="popular">Terpopuler</option>
              <option value="rating">Rating tertinggi</option>
              <option value="newest">Terbaru</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3" />
          </label>
        </div>

        {/* Results Grid */}
        {loading && talents.length === 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4" aria-label="Memuat Talent">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 rounded-[28px] border border-white bg-white/70 shadow-[0_12px_34px_rgba(76,29,149,0.07)] animate-pulse" />
            ))}
          </div>
        ) : errorMsg && talents.length === 0 ? (
          <div className="p-4 sm:p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => void loadMarketplaceData(searchQuery)}
              className="min-h-11 px-3 py-2 bg-rose-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-rose-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : filteredTalents.length > 0 ? (
          <section aria-label="Daftar Talent" className="space-y-2 pb-3 sm:pb-0">
            {loading && (
              <p className="text-center text-[11px] font-medium text-slate-500" role="status" aria-live="polite">
                Memuat hasil terbaru. Kartu yang masih terlihat mungkin berasal dari pencarian sebelumnya.
              </p>
            )}
            {errorMsg && (
              <p className="text-center text-[11px] text-amber-700" role="status">
                Data belum berhasil diperbarui. Menampilkan hasil sebelumnya.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">
              {displayTalents.slice(0, visibleTalentCount).map((talent) => (
                <div key={talent.id} className="min-w-0">
                  <TalentCard
                    talent={talent}
                    showPrice={false}
                    compact
                    priceMode={selectedMode === 'online' || selectedMode === 'offline' ? selectedMode : 'all'}
                    onSelect={(id) => onNavigate('/talent/:id', { id })}
                  />
                </div>
              ))}
            </div>
            <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-2 w-full" />
            {(loadingMoreTalents || loadMoreError) && (
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                {loadingMoreTalents && <span className="text-xs text-slate-500">Memuat Talent berikutnya...</span>}
                {loadMoreError && (
                  <>
                    <span role="alert" className="text-xs text-rose-600">{loadMoreError}</span>
                    <button type="button" onClick={() => void loadNextTalentBatch()} className="min-h-11 rounded-lg bg-purple-700 px-4 text-xs font-semibold text-white">
                      Coba muat lagi
                    </button>
                  </>
                )}
              </div>
            )}
            {!hasMoreTalents && talents.length > 0 && visibleTalentCount >= filteredTalents.length && (
              <p className="py-3 text-center text-xs text-slate-400">Semua Talent yang tersedia sudah ditampilkan.</p>
            )}
          </section>
        ) : loading && talents.length > 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[28px] border border-purple-100 bg-white/85 px-5 py-10 text-center shadow-[0_16px_42px_rgba(76,29,149,0.06)]" role="status" aria-live="polite">
            <RefreshCw className="h-5 w-5 animate-spin text-purple-600" />
            <p className="text-sm font-semibold text-slate-700">Mencari Talent yang sesuai...</p>
            <p className="text-xs text-slate-500">Hasil akan muncul setelah pencarian selesai.</p>
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
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleResetFilters}
                className="min-h-11 px-4 py-2 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 transition-colors"
              >
                Reset Semua Filter
              </button>
              {hasMoreTalents && (
                <button
                  type="button"
                  onClick={() => void loadNextTalentBatch()}
                  disabled={loadingMoreTalents}
                  className="min-h-11 px-4 text-xs font-semibold text-purple-700 disabled:opacity-50"
                >
                  {loadingMoreTalents ? 'Memuat...' : 'Cari Talent berikutnya'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
