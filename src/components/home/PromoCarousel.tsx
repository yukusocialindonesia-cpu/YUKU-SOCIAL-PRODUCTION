import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight, Megaphone } from 'lucide-react';
import { PromotionRow } from '../../types/database';
import { AppRoute } from '../../types/navigation';

interface PromoCarouselProps {
  promotions: PromotionRow[];
  isLoading?: boolean;
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
  compact?: boolean;
}

// Sama dengan banner Hero di atasnya.
const SLIDE_INTERVAL_MS = 6000;
const DEFAULT_RATIO = 16 / 9;

export const PromoCarousel: React.FC<PromoCarouselProps> = ({
  promotions,
  isLoading = false,
  onNavigate,
  compact = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});
  // Rasio asli tiap poster (lebar/tinggi), diisi saat gambar selesai dimuat,
  // supaya kotak slide mengikuti poster dan isinya tidak terpotong.
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    if (activeIndex >= promotions.length) {
      setActiveIndex(0);
    }
  }, [promotions.length, activeIndex]);

  const totalSlides = promotions.length;
  const rawRatio = imageRatios[promotions[activeIndex]?.id ?? ''] ?? DEFAULT_RATIO;
  const frameRatio = Math.min(3, Math.max(1.5, rawRatio));

  const handleNext = useCallback(() => {
    if (totalSlides <= 1) return;
    setActiveIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const handlePrev = useCallback(() => {
    if (totalSlides <= 1) return;
    setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Geser otomatis. Dihentikan saat disentuh/di-hover atau jika pengguna meminta mengurangi gerakan.
  useEffect(() => {
    if (totalSlides <= 1 || isPaused || prefersReducedMotion) return;
    const timer = window.setInterval(handleNext, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [totalSlides, isPaused, prefersReducedMotion, handleNext, activeIndex]);

  const handlePosterClick = (promo: PromotionRow) => {
    const rawLink = promo.link_url?.trim();
    if (!rawLink) return;
    if (rawLink.startsWith('/')) {
      onNavigate(rawLink as AppRoute);
    }
  };

  return (
    <section aria-label="Ruang Promosi YUKU" className={compact ? 'relative py-0 bg-transparent' : 'relative py-2.5 sm:py-10 bg-gradient-to-b from-white via-[#FCFAFF] to-[#F8F5FF]'}>
      <div className={compact ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        {isLoading ? (
          <div className={`w-full h-[112px] sm:h-auto sm:aspect-[16/9] md:max-w-[1000px] md:mx-auto rounded-[22px] sm:rounded-3xl bg-gradient-to-br from-purple-50 to-slate-100 animate-pulse border border-purple-100/80 ${compact ? '' : 'sm:aspect-[16/9]'}`} />
        ) : totalSlides === 0 ? (
          <div className="relative h-[112px] w-full overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-900 via-purple-700 to-fuchsia-600 px-4 py-3.5 sm:h-auto sm:aspect-[21/6] sm:px-6 sm:py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative z-10 flex items-start gap-3 sm:gap-4 max-w-[65%]">
              <div className="hidden sm:flex w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 text-amber-300 items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Teman Baru, Cerita Baru
                </h3>
                <p className="text-[11px] sm:text-sm text-white/85 leading-relaxed">
                  Yuk ngopi bareng minggu ini.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/talent')}
              className="min-h-8 w-auto px-3.5 py-1.5 bg-white hover:bg-purple-50 text-purple-800 text-[11px] font-bold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Lihat Aktivitas
            </button>
            <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_55%_45%,rgba(255,255,255,0.28),transparent_48%)]">
              <div className="absolute right-5 top-5 h-16 w-16 rounded-full border border-white/25 sm:h-28 sm:w-28" />
              <div className="absolute bottom-0 right-0 h-20 w-28 rounded-tl-[3rem] bg-white/10 sm:h-32 sm:w-48" />
            </div>
          </div>
        ) : (
          <div
            className="relative md:max-w-[1000px] md:mx-auto"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={(e) => {
              setTouchStartX(e.touches[0]?.clientX ?? null);
              setIsPaused(true);
            }}
            onTouchEnd={(e) => {
              const endX = e.changedTouches[0]?.clientX ?? null;
              if (touchStartX !== null && endX !== null) {
                const deltaX = endX - touchStartX;
                if (deltaX <= -40) {
                  handleNext();
                } else if (deltaX >= 40) {
                  handlePrev();
                }
              }
              setTouchStartX(null);
              setIsPaused(false);
            }}
          >
            {/* Kotak mengikuti rasio asli poster yang sedang tampil (dibatasi 3:2 sampai 3:1), jadi poster tidak terpotong. */}
            <div
              className={`relative w-full overflow-hidden rounded-[18px] border border-white/90 bg-slate-900 shadow-[0_8px_20px_rgba(76,29,149,0.10)] sm:rounded-[28px] sm:shadow-[0_20px_48px_rgba(76,29,149,0.16)] ring-1 ring-purple-100/80 touch-pan-y ${compact ? 'h-[112px] sm:h-auto' : ''}`}
              style={compact ? undefined : { aspectRatio: String(frameRatio) }}
            >
              {promotions.map((promo, index) => {
                const isCurrent = index === activeIndex;
                const isBroken = Boolean(brokenImageIds[promo.id]);
                const link = promo.link_url?.trim() || '';
                const isExternal = link.startsWith('http://') || link.startsWith('https://');
                const isInternal = link.startsWith('/');

                const slideBody = (
                  <div className="relative w-full h-full">
                    {isBroken ? (
                      <div className="w-full h-full bg-gradient-to-br from-purple-950 via-[#2D1052] to-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                        <Megaphone className="w-8 h-8 text-amber-400 mb-2" />
                        <p className="text-sm sm:text-base font-bold">{promo.title}</p>
                      </div>
                    ) : (
                      <img
                        src={promo.image_url}
                        alt={promo.title || 'Poster promosi YUKU'}
                        referrerPolicy="no-referrer"
                        loading={index === 0 ? 'eager' : 'lazy'}
                        onLoad={(e) => {
                          const { naturalWidth, naturalHeight } = e.currentTarget;
                          if (naturalWidth > 0 && naturalHeight > 0) {
                            setImageRatios((prev) => ({
                              ...prev,
                              [promo.id]: naturalWidth / naturalHeight,
                            }));
                          }
                        }}
                        onError={() => setBrokenImageIds((prev) => ({ ...prev, [promo.id]: true }))}
                        className={compact ? "absolute right-0 top-0 h-full w-[42%] object-cover object-center" : "h-full w-full object-contain"}
                      />
                    )}

                    {compact && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-950 via-purple-900/95 via-55% to-purple-900/10" />
                        <div className="absolute left-4 top-1/2 z-10 max-w-[62%] -translate-y-1/2 text-white sm:left-7">
                          <p className="text-sm font-extrabold leading-tight sm:text-xl">Teman Baru, Cerita Baru</p>
                          <p className="mt-1 text-[10px] leading-snug text-white/85 sm:text-sm">Yuk ngopi bareng minggu ini</p>
                          <span className="mt-2 inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[10px] font-extrabold text-purple-800 sm:text-xs">Lihat Aktivitas</span>
                        </div>
                      </>
                    )}
                    {(isInternal || isExternal) && (
                      <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-950/80 text-white text-[10px] sm:text-xs font-bold inline-flex items-center gap-1 sm:gap-1.5 backdrop-blur-xs">
                        <span>Lihat Promo</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                    )}
                  </div>
                );

                return (
                  <div
                    key={promo.id}
                    aria-hidden={!isCurrent}
                    className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
                      isCurrent ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    {isExternal ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isCurrent ? 0 : -1}
                        className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                        aria-label={promo.title}
                      >
                        {slideBody}
                      </a>
                    ) : isInternal ? (
                      <button
                        type="button"
                        onClick={() => handlePosterClick(promo)}
                        tabIndex={isCurrent ? 0 : -1}
                        className="block w-full h-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                        aria-label={promo.title}
                      >
                        {slideBody}
                      </button>
                    ) : (
                      slideBody
                    )}
                  </div>
                );
              })}

              {/* Kontrol: titik di atas gambar (seperti Hero), panah hanya di layar lebar */}
              {totalSlides > 1 && (
                <div className="absolute z-20 bottom-2 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:bottom-4 md:right-5 flex items-center gap-2">
                  <div role="tablist" aria-label="Pilih poster promosi" className="flex items-center mr-1">
                    {promotions.map((promo, index) => {
                      const isCurrent = index === activeIndex;
                      return (
                        <button
                          key={promo.id}
                          type="button"
                          role="tab"
                          aria-selected={isCurrent}
                          aria-label={`Tampilkan poster ${index + 1}: ${promo.title}`}
                          onClick={() => setActiveIndex(index)}
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
                    onClick={handlePrev}
                    aria-label="Poster sebelumnya"
                    className="hidden md:inline-flex w-9 h-9 rounded-full bg-white/90 hover:bg-white text-purple-900 shadow items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Poster berikutnya"
                    className="hidden md:inline-flex w-9 h-9 rounded-full bg-white/90 hover:bg-white text-purple-900 shadow items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
