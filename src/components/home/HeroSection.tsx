import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { SearchActivityWidget } from './SearchActivityWidget';
import { HeroSlideRow } from '../../types/database';
import { fetchHeroSlidesFromSupabase } from '../../utils/supabaseMarketplace';

interface HeroSectionProps {
  onExploreClick: () => void;
  onSearch: (activity: string, city: string) => void;
  onRegisterCustomerClick: () => void;
  /** Dipanggil saat slide dengan tautan internal (diawali "/") diklik. */
  onSlideLinkClick?: (path: string) => void;
}

const SLIDE_INTERVAL_MS = 6000;
const SLIDES_CACHE_KEY = 'yuku_hero_slides_cache_v1';

/** Baca slide terakhir yang tersimpan di HP agar foto langsung tampil saat dibuka/refresh. */
function readCachedSlides(): HeroSlideRow[] {
  try {
    const raw = localStorage.getItem(SLIDES_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HeroSlideRow[]) : [];
  } catch {
    return [];
  }
}

function writeCachedSlides(rows: HeroSlideRow[]) {
  try {
    if (rows.length > 0) localStorage.setItem(SLIDES_CACHE_KEY, JSON.stringify(rows));
    else localStorage.removeItem(SLIDES_CACHE_KEY);
  } catch {
    // Penyimpanan penuh atau diblokir: abaikan, hero tetap berfungsi tanpa cache.
  }
}

/**
 * Hero Beranda berupa slide gambar yang diatur Admin
 * (Admin > "Slide Hero", tabel public.hero_slides).
 * Jika belum ada slide aktif, memakai /hero-home.jpg atau gradasi bermerek.
 */
export const HeroSection: React.FC<HeroSectionProps> = ({
  onSearch,
  onRegisterCustomerClick,
  onSlideLinkClick,
}) => {
  const [slides, setSlides] = useState<HeroSlideRow[]>(() => readCachedSlides());
  const [slidesLoaded, setSlidesLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [fallbackOk, setFallbackOk] = useState(true);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchHeroSlidesFromSupabase().then((rows) => {
      if (!mounted) return;
      setSlides(rows);
      setSlidesLoaded(true);
      writeCachedSlides(rows);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const total = slides.length;

  useEffect(() => {
    if (active >= total) setActive(0);
  }, [total, active]);

  const next = useCallback(() => {
    if (total > 1) setActive((i) => (i + 1) % total);
  }, [total]);
  const prev = useCallback(() => {
    if (total > 1) setActive((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || paused || reducedMotion) return;
    const timer = window.setInterval(next, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [total, paused, reducedMotion, next, active]);

  const currentLink = total > 0 ? slides[active]?.link_url?.trim() || '' : '';
  const isExternal = /^https?:\/\//i.test(currentLink);
  const isInternal = currentLink.startsWith('/');

  const handleBackdropClick = () => {
    if (isInternal && onSlideLinkClick) onSlideLinkClick(currentLink);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Sorotan YUKU"
      className="relative overflow-hidden bg-transparent"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setTouchStartX(e.touches[0]?.clientX ?? null);
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const endX = e.changedTouches[0]?.clientX ?? null;
        if (touchStartX !== null && endX !== null) {
          const dx = endX - touchStartX;
          if (dx <= -50) next();
          else if (dx >= 50) prev();
        }
        setTouchStartX(null);
        setPaused(false);
      }}
    >
      {/* Gambar slide (crossfade): banner rasio tetap di HP, lapisan penuh di layar lebar.
          Rasio 12:5 sama dengan gambar desktop 1920x800, jadi foto tampil utuh di HP. */}
      {/* HP: banner foto di atas (tanpa teks menimpa wajah). md ke atas: lapisan penuh seperti semula. */}
      <div className="relative mx-4 mt-1 h-[clamp(140px,42vw,190px)] sm:h-[clamp(220px,34vw,300px)] rounded-[26px] overflow-hidden border border-white shadow-[0_16px_36px_rgba(76,29,149,0.16),0_3px_10px_rgba(76,29,149,0.06)] ring-1 ring-purple-100/80 md:absolute md:inset-0 md:m-0 md:h-auto md:rounded-none md:overflow-visible md:border-0 md:shadow-none md:ring-0">
        {total > 0 ? (
          slides.map((slide, index) => {
            const isCurrent = index === active;
            return (
              <div
                key={slide.id}
                aria-hidden={!isCurrent}
                className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
                  isCurrent ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {broken[slide.id] ? (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 via-fuchsia-500 to-amber-400" />
                ) : (
                  <picture>
                    {slide.mobile_image_url && (
                      <source media="(max-width: 767px)" srcSet={slide.mobile_image_url} />
                    )}
                    <img
                      src={slide.image_url}
                      alt={slide.title}
                      referrerPolicy="no-referrer"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      onError={() => setBroken((p) => ({ ...p, [slide.id]: true }))}
                      className={`w-full h-full object-cover md:object-[70%_20%] ${
                        slide.mobile_image_url ? 'object-center' : 'object-[70%_20%]'
                      }`}
                    />
                  </picture>
                )}
              </div>
            );
          })
        ) : !slidesLoaded ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-slate-200/70 animate-pulse motion-reduce:animate-none"
          />
        ) : (
          <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#5B0DB5] via-[#9412C8] to-[#E52DA8]">
            <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#FFB52E]/80 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#F5A6E8]/50 blur-3xl" />
            <div className="absolute right-5 top-5 h-24 w-24 rounded-full border-[14px] border-white/15 sm:right-12 sm:top-8 sm:h-36 sm:w-36" />
            <div className="absolute inset-y-0 left-0 flex max-w-[78%] flex-col justify-center px-5 text-white sm:max-w-[65%] sm:px-10 md:max-w-[60%]">
              <span className="mb-2 inline-flex w-fit items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] sm:text-xs">YUKU • Real Friends</span>
              <p className="text-[clamp(1.25rem,5vw,2.6rem)] font-black leading-[1.05] tracking-tight drop-shadow-sm">Temukan teman untuk setiap momen.</p>
              <p className="mt-2 max-w-sm text-[11px] font-medium leading-relaxed text-white/90 sm:text-sm">Jalan bareng, menikmati hobi, dan ciptakan pengalaman nyata.</p>
            </div>
            <div className="absolute bottom-4 right-5 rounded-full bg-white px-4 py-2 text-[10px] font-extrabold text-[#6410B5] shadow-lg sm:bottom-7 sm:right-10 sm:px-5 sm:py-2.5 sm:text-xs">Jelajahi Talent ↗</div>
            <div className="absolute left-[58%] top-5 text-3xl text-white/80 sm:top-8 sm:text-5xl">✦</div>
            <div className="absolute bottom-7 left-[52%] text-2xl text-[#FFD52A] sm:text-4xl">✦</div>
          </div>
        )}

        {/* Scrim kiri agar teks tetap terbaca di atas gambar apa pun */}
        {total > 0 && (
          <div className="hidden md:block absolute inset-0 pointer-events-none md:bg-gradient-to-r md:from-white/90 md:via-white/55 md:to-transparent md:w-[62%]" />
        )}

        {/* Area klik slide (di belakang konten) */}
        {isExternal && (
          <a
            href={currentLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={slides[active]?.title}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-700"
          />
        )}
        {isInternal && (
          <button
            type="button"
            onClick={handleBackdropClick}
            aria-label={slides[active]?.title}
            className="absolute inset-0 w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-700"
          />
        )}

        {/* Kontrol slide: panah + titik */}
        {total > 1 && (
          <div className="absolute z-20 bottom-2 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:bottom-5 md:right-6 flex items-center gap-2">
            <div role="tablist" aria-label="Pilih slide" className="flex items-center mr-1">
              {slides.map((slide, index) => {
                const isCurrent = index === active;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    aria-label={`Slide ${index + 1}: ${slide.title}`}
                    onClick={() => setActive(index)}
                    className="min-w-[28px] min-h-[40px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 rounded-lg"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all duration-200 ${
                        isCurrent ? 'w-6 bg-white shadow' : 'w-2 bg-white/60 hover:bg-white/90'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={prev}
              aria-label="Slide sebelumnya"
              className="hidden md:inline-flex w-9 h-9 rounded-full bg-white/90 hover:bg-white text-purple-900 shadow items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Slide berikutnya"
              className="hidden md:inline-flex w-9 h-9 rounded-full bg-white/90 hover:bg-white text-purple-900 shadow items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Konten tetap di depan slide */}
      <div
        className="relative z-10 pointer-events-none max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1.5 pb-1 md:pt-16 md:pb-16"
      >
        <div className="md:max-w-xl">
          {/* HP: label kecil di atas judul (tidak menutupi foto) */}
          <p className="md:hidden flex items-center gap-1.5 mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-purple-700">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Social Experience & Paid Companionship</span>
          </p>
          <div className="hidden md:inline-flex max-w-full items-center gap-2 px-3 py-1 bg-white/80 border border-purple-200/80 rounded-full text-purple-900 text-xs font-semibold mb-5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-purple-700" />
            <span className="truncate">Social Experience & Paid Companionship</span>
          </div>

          <h1 className="text-[clamp(1.75rem,5.2vw,3.75rem)] leading-[1.06] font-black text-[#1E0938] tracking-tight mb-1 md:mb-4">
            <span className="hero-slogan-enter">Real Friends.</span>{' '}
            <br className="md:hidden" />
            <span className="hero-slogan-enter hero-slogan-enter-delay bg-gradient-to-r from-purple-700 via-fuchsia-600 to-amber-500 bg-clip-text text-transparent">
              Real Moments.
            </span>
          </h1>

          <p className="max-w-2xl text-[14px] leading-relaxed sm:text-base md:text-lg md:leading-relaxed text-slate-700">
            Temukan teman terbaik untuk menemani setiap aktivitas dan momen berharga dalam hidupmu.
          </p>
        </div>

        <div className="mt-1 md:mt-8 md:max-w-3xl pointer-events-auto">
          <SearchActivityWidget onSearch={onSearch} />
          {/* HP: tiga poin keamanan dalam satu baris (huruf kecil), tombol daftar satu baris penuh di bawahnya.
              Layar sangat sempit: poin boleh turun baris. Layar lebar: satu baris seperti semula. */}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] leading-snug whitespace-nowrap text-slate-800 md:justify-start md:gap-x-5 md:gap-y-1.5 md:text-xs">
            <span className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 shrink-0 rounded-full bg-purple-600" />Ruang publik & aman</span>
            <span className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 shrink-0 rounded-full bg-purple-600" />Bukan aplikasi kencan</span>
            <span className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 shrink-0 rounded-full bg-purple-600" />Verifikasi 18+</span>
            <button
              type="button"
              onClick={onRegisterCustomerClick}
              className="basis-full mt-0 md:mt-0 md:basis-auto w-full md:w-auto text-xs px-4 py-2 md:py-1.5 rounded-full border border-purple-300 bg-white/90 hover:bg-white font-bold text-purple-800 hover:text-purple-950 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700"
            >
              Daftar gratis
            </button>
          </div>
        </div>
      </div>

    </section>
  );
};
