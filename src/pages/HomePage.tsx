import React, { useState, useEffect, useRef } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { ServiceModeSection } from '../components/home/ServiceModeSection';
import { PromoCarousel } from '../components/home/PromoCarousel';
import { ActivityCategories } from '../components/home/ActivityCategories';
import { FeaturedTalentSection } from '../components/home/FeaturedTalentSection';
import { HowItWorksSection } from '../components/home/HowItWorksSection';
import { SafetySection } from '../components/home/SafetySection';
import { TalentCtaSection } from '../components/home/TalentCtaSection';
import { HomeFaqSection } from '../components/home/HomeFaqSection';
import { AppRoute } from '../types/navigation';
import { ActivityCategoryId } from '../types/talent';
import { PromotionRow } from '../types/database';
import { fetchPromotionsFromSupabase } from '../utils/supabaseMarketplace';

interface HomePageProps {
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);
  const promoSectionRef = useRef<HTMLDivElement | null>(null);

  // Poster promosi berada di bawah Talent Pilihan. Ambil datanya saat area
  // mendekati layar agar permintaan awal beranda lebih ringan.
  useEffect(() => {
    const target = promoSectionRef.current;
    if (!target) return;

    let isMounted = true;
    let hasLoaded = false;
    let observer: IntersectionObserver | null = null;

    const loadPromotions = async () => {
      if (hasLoaded) return;
      hasLoaded = true;
      try {
        const data = await fetchPromotionsFromSupabase();
        if (isMounted) setPromotions(data);
      } catch {
        if (isMounted) setPromotions([]);
      } finally {
        if (isMounted) setIsLoadingPromotions(false);
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      void loadPromotions();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void loadPromotions();
            observer?.disconnect();
          }
        },
        { rootMargin: '300px 0px' }
      );
      observer.observe(target);
    }

    return () => {
      isMounted = false;
      observer?.disconnect();
    };
  }, []);

  const handleSearch = (activity: string, city: string) => {
    onNavigate('/talent', { activity, city });
  };

  const handleSelectCategory = (categoryId: ActivityCategoryId) => {
    onNavigate('/talent', { activity: categoryId });
  };

  const handleSelectTalent = (talentId: string) => {
    onNavigate(`/talent/:id`, { id: talentId });
  };

  return (
    <div className="yuku-home-surface relative isolate flex min-h-screen flex-col overflow-hidden">
      {/* 2. Hero Section with Tagline ("Real Friends. Real Moments.") & 3. Tombol Jelajahi Talent */}
      {/* 4. Pencarian berdasarkan aktivitas dan lokasi */}
      <HeroSection
        onExploreClick={() => onNavigate('/talent')}
        onSearch={handleSearch}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onSlideLinkClick={(path) => onNavigate(path as AppRoute)}
      />

      {/* Pilihan layanan utama: offline dan online */}
      <ServiceModeSection onSelectMode={(mode) => onNavigate('/talent', { mode })} />

      {/* Kategori Aktivitas */}
      <ActivityCategories onSelectCategory={handleSelectCategory} />

      {/* Talent Pilihan dari profil publik Supabase */}
      <FeaturedTalentSection
        onSelectTalent={handleSelectTalent}
        onViewAllClick={() => onNavigate('/talent')}
      />

      {/* Ruang Promosi Poster Berjalan */}
      <div ref={promoSectionRef}>
        <PromoCarousel
          promotions={promotions}
          isLoading={isLoadingPromotions}
          onNavigate={onNavigate}
        />
      </div>

      {/* Cara kerja setelah pengunjung melihat pilihan Talent dan promosi */}
      <HowItWorksSection onLearnMoreClick={() => onNavigate('/cara-kerja')} />

      {/* Keamanan dan Verifikasi */}
      <SafetySection />

      {/* 10. Ajakan Customer & Tautan Talent */}
      <TalentCtaSection
        onExploreClick={() => onNavigate('/talent')}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onRegisterClick={() => onNavigate('/daftar-talent')}
      />

      {/* 11. FAQ */}
      <HomeFaqSection onViewAllFaqClick={() => onNavigate('/faq')} />
    </div>
  );
};
