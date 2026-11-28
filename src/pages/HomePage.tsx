import React, { useState, useEffect, useRef } from 'react';
import { Users, BriefcaseBusiness, ArrowRight } from 'lucide-react';
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
import { EcosystemSection } from '../components/home/EcosystemSection';
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
    <div className="yuku-home-feed relative isolate flex min-h-screen flex-col overflow-hidden bg-[#F8F7FA] text-[#32134F]">
      <section className="px-4 pt-4 pb-2 md:hidden">
        <div className="mb-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#32134F]">YUKU</p>
          <h1 className="mt-1.5 text-[22px] font-extrabold leading-[1.15] tracking-tight text-[#32134F]">Mau cari apa hari ini?</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">Temukan teman nyata atau layanan profesional dalam satu aplikasi.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/talent')}
            className="group flex min-h-[142px] flex-col items-start justify-between rounded-[20px] border border-[#32134F] bg-[#32134F] p-3.5 text-left text-white shadow-[0_8px_20px_rgba(50,19,79,0.13)] transition active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/15">
              <Users className="h-5 w-5" />
            </span>
            <span className="mt-3 block">
              <span className="block text-[14px] font-extrabold leading-tight">Teman Aktivitas</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-white/80">Ngobrol, hangout, jalan-jalan, dan kegiatan bersama.</span>
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold">Cari teman <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/jasa-profesional')}
            className="group flex min-h-[142px] flex-col items-start justify-between rounded-[20px] border border-[#32134F]/15 bg-white p-3.5 text-left text-[#32134F] shadow-[0_8px_20px_rgba(50,19,79,0.06)] transition active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#32134F] text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <span className="mt-3 block">
              <span className="block text-[14px] font-extrabold leading-tight">Jasa Profesional</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-slate-600">Fotografer, MUA, trainer, konsultan, dan ahli.</span>
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold">Cari layanan <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
        </div>
      </section>

      <div className="yuku-home-hero hidden md:block">
        <HeroSection
          onExploreClick={() => onNavigate('/talent')}
          onSearch={handleSearch}
          onRegisterCustomerClick={() => onNavigate('/register')}
          onSlideLinkClick={(path) => onNavigate(path as AppRoute)}
        />
      </div>

      <div className="yuku-home-section yuku-home-categories">
        <ActivityCategories onSelectCategory={handleSelectCategory} />
      </div>

      <div className="hidden sm:block yuku-home-section bg-white">
        <ServiceModeSection onSelectMode={(mode) => onNavigate('/talent', { mode })} />
      </div>

      <div className="yuku-home-section yuku-home-featured">
        <FeaturedTalentSection
          onSelectTalent={handleSelectTalent}
          onViewAllClick={() => onNavigate('/talent')}
        />
      </div>

      <div className="hidden sm:block"><ProfessionalServicesSection onViewAll={() => onNavigate('/jasa-profesional')} /></div>
      <div className="hidden sm:block"><EcosystemSection onCommunityClick={() => onNavigate('/komunitas')} onMerchantClick={() => onNavigate('/merchant-partner')} /></div>

      <div className="hidden sm:block yuku-home-section bg-white">
        <HowItWorksSection onLearnMoreClick={() => onNavigate('/cara-kerja')} />
        <SafetySection />
      </div>

      <div ref={promoSectionRef} className="hidden sm:block yuku-home-section bg-[#F8F7FA]">
        <PromoCarousel
          promotions={promotions}
          isLoading={isLoadingPromotions}
          onNavigate={onNavigate}
        />
      </div>

      <div className="hidden sm:block">
        <TalentCtaSection
          onExploreClick={() => onNavigate('/talent')}
          onRegisterCustomerClick={() => onNavigate('/register')}
          onRegisterClick={() => onNavigate('/daftar-talent')}
          onProfessionalRegisterClick={() => onNavigate('/daftar-jasa-profesional')}
        />
      </div>
      <div className="hidden sm:block"><HomeFaqSection onViewAllFaqClick={() => onNavigate('/faq')} /></div>
    </div>
  );
};
