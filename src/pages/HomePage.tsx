import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Users } from 'lucide-react';
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
    onNavigate('/talent/:id', { id: talentId });
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-[#FBF8FF] via-white to-[#FFF9F3]">
      <HeroSection
        onExploreClick={() => onNavigate('/talent')}
        onSearch={handleSearch}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onSlideLinkClick={(path) => onNavigate(path as AppRoute)}
      />

      <ServiceModeSection onSelectMode={(mode) => onNavigate('/talent', { mode })} />

      <ActivityCategories onSelectCategory={handleSelectCategory} />

      <FeaturedTalentSection
        onSelectTalent={handleSelectTalent}
        onViewAllClick={() => onNavigate('/talent')}
      />

      <section className="bg-white py-3 sm:py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onNavigate('/komunitas')}
            className="group flex w-full items-center gap-3 rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 to-white p-3 text-left transition hover:border-purple-200 sm:p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-purple-800 shadow-sm">
              <Users className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-900 sm:text-base">Gabung Komunitas YUKU</span>
              <span className="mt-0.5 block text-[11px] text-slate-600 sm:text-sm">Temukan orang dengan minat yang sama dan mulai berinteraksi.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-purple-800 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <ProfessionalServicesSection onViewAll={() => onNavigate('/jasa-profesional')} />

      <HowItWorksSection onLearnMoreClick={() => onNavigate('/cara-kerja')} />

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
