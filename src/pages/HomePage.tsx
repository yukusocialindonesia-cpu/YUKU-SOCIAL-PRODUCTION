import React, { useState, useEffect, useRef } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { ServiceModeSection } from '../components/home/ServiceModeSection';
import { PromoCarousel } from '../components/home/PromoCarousel';
import { ActivityCategories } from '../components/home/ActivityCategories';
import { ProfessionalServicesSection } from '../components/home/ProfessionalServicesSection';
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

  // Pertahankan posisi poster setelah Talent dan Keamanan. Data dimuat
  // ketika bagian promosi mendekati layar agar beban awal Beranda tetap ringan.
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
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-[#FBF8FF] via-white to-[#FFF9F3]">
      {/* Alur lama dipertahankan: pengunjung memahami layanan sebelum memilih Talent. */}
      <HeroSection
        onExploreClick={() => onNavigate('/talent')}
        onSearch={handleSearch}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onSlideLinkClick={(path) => onNavigate(path as AppRoute)}
      />

      <ServiceModeSection onSelectMode={(mode) => onNavigate('/talent', { mode })} />

      <ActivityCategories onSelectCategory={handleSelectCategory} />

      {/* Katalog jasa profesional ditambahkan tanpa menggantikan kategori aktivitas lama. */}
      <ProfessionalServicesSection onViewAll={() => onNavigate('/jasa-profesional')} />

      {/* Cara kerja tetap muncul sebelum daftar Talent, sesuai alur Beranda lama. */}
      <HowItWorksSection onLearnMoreClick={() => onNavigate('/cara-kerja')} />

      <FeaturedTalentSection
        onSelectTalent={handleSelectTalent}
        onViewAllClick={() => onNavigate('/talent')}
      />

      {/* Keamanan tetap diperlihatkan sebelum ruang promosi. */}
      <SafetySection />

      <div ref={promoSectionRef}>
        <PromoCarousel
          promotions={promotions}
          isLoading={isLoadingPromotions}
          onNavigate={onNavigate}
        />
      </div>

      <TalentCtaSection
        onExploreClick={() => onNavigate('/talent')}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onRegisterClick={() => onNavigate('/daftar-talent')}
      />

      <HomeFaqSection onViewAllFaqClick={() => onNavigate('/faq')} />
    </div>
  );
};
