import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
} from 'lucide-react';
import SearchActivityWidget from '../SearchActivityWidget';
import type { HeroSlideRow } from '../../types/hero';
import { fetchHeroSlidesFromSupabase } from '../../lib/heroSlides';

const DEFAULT_SLIDES: HeroSlideRow[] = [
  {
    id: 'default-1',
    title: 'Temukan Teman untuk Setiap Momen',
    subtitle: 'Real Friends. Real Moments.',
    description:
      'Cari teman untuk ngopi, jalan-jalan, nonton, menghadiri acara, atau sekadar ngobrol.',
    image_url:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=85',
    button_text: 'Cari Talent',
    button_url: '/talent',
    is_active: true,
    sort_order: 1,
  },
];

export default function HeroSection() {
  const [slides, setSlides] = useState<HeroSlideRow[]>([]);
  const [slidesLoaded, setSlidesLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetchHeroSlidesFromSupabase()
      .then((rows) => {
        if (!mounted) return;

        const nextSlides = rows.length > 0 ? rows : DEFAULT_SLIDES;
        setSlides(nextSlides);
        setSlidesLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;

        setSlides(DEFAULT_SLIDES);
        setSlidesLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeIndex >= slides.length && slides.length > 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  const goToPrevious = useCallback(() => {
    setActiveIndex((current) =>
      slides.length > 0
        ? (current - 1 + slides.length) % slides.length
        : 0,
    );
  }, [slides.length]);

  const goToNext = useCallback(() => {
    setActiveIndex((current) =>
      slides.length > 0 ? (current + 1) % slides.length : 0,
    );
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeSlide = slides[activeIndex];

  if (!slidesLoaded) {
    return (
      <section className="relative min-h-[620px] overflow-hidden bg-slate-900">
        <div className="absolute inset-0 animate-pulse bg-slate-800" />
        <div className="relative z-10 mx-auto flex min-h-[620px] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="w-full max-w-3xl">
            <div className="mb-5 h-5 w-40 rounded bg-white/10" />
            <div className="mb-4 h-16 w-full max-w-2xl rounded bg-white/10" />
            <div className="mb-8 h-16 w-4/5 max-w-xl rounded bg-white/10" />
            <div className="h-12 w-40 rounded-xl bg-white/10" />
          </div>
        </div>
      </section>
    );
  }

  if (!activeSlide) {
    return null;
  }

  const handleButtonClick = () => {
    if (!activeSlide.button_url) return;

    if (activeSlide.button_url.startsWith('http')) {
      window.location.href = activeSlide.button_url;
      return;
    }

    window.history.pushState({}, '', activeSlide.button_url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section className="relative min-h-[620px] overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-slate-800" />
        )}

        <img
          key={activeSlide.id}
          src={activeSlide.image_url}
          alt={activeSlide.title || 'YUKU'}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />

        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[620px] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl text-white">
          {activeSlide.subtitle && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <MapPin className="h-4 w-4" />
              {activeSlide.subtitle}
            </div>
          )}

          {activeSlide.title && (
            <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {activeSlide.title}
            </h1>
          )}

          {activeSlide.description && (
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
              {activeSlide.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            {activeSlide.button_text && (
              <button
                type="button"
                onClick={handleButtonClick}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                {activeSlide.button_text}
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-10 max-w-3xl">
            <SearchActivityWidget />
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Slide sebelumnya"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/25 p-3 text-white backdrop-blur-sm transition hover:bg-black/45 sm:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="Slide berikutnya"
            onClick={goToNext}
            className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/25 p-3 text-white backdrop-blur-sm transition hover:bg-black/45 sm:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Buka slide ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex
                    ? 'w-8 bg-white'
                    : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
