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
      <section className="px-4 pt-3 pb-2 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#32134F] text-[15px] font-black tracking-tight text-white shadow-[0_5px_14px_rgba(50,19,79,0.18)]">Y</div>
            <div className="min-w-0">
              <p className="text-[17px] font-black leading-none tracking-[-0.04em] text-[#32134F]">YUKU</p>
              <p className="mt-1 truncate text-[10px] font-medium text-slate-500">Teman, aktivitas & layanan</p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate('/talent')} aria-label="Cari di YUKU" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#32134F]/10 bg-white text-[#32134F] shadow-sm active:scale-95">
            <span className="text-lg leading-none">⌕</span>
          </button>
        </div>
        <div className="mb-2.5 mt-5 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#32134F]/55">JELAJAHI YUKU</p>
            <h1 className="mt-0.5 text-[19px] font-extrabold leading-tight tracking-tight text-[#32134F]">Kamu lagi cari apa?</h1>
          </div>
          <span className="pb-0.5 text-[10px] font-semibold text-slate-400">Pilih kategori</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onNavigate('/talent')} className="group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-[18px] bg-[#32134F] p-3 text-left text-white shadow-[0_7px_18px_rgba(50,19,79,0.15)] transition active:scale-[0.98]">
            <span aria-hidden="true" className="pointer-events-none absolute -right-5 -top-7 h-24 w-24 rounded-full border-[13px] border-white/[0.09]" />
            <span className="relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/15"><Users className="h-[18px] w-[18px]" /></span>
            <span className="relative block">
              <span className="block text-[13px] font-extrabold leading-tight">Teman Aktivitas</span>
              <span className="mt-1 block text-[9px] font-medium text-white/75">Cari teman untuk melakukan hal seru</span>
            </span>
          </button>
          <button type="button" onClick={() => onNavigate('/jasa-profesional')} className="group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-[18px] border border-[#32134F]/12 bg-white p-3 text-left text-[#32134F] shadow-[0_5px_15px_rgba(50,19,79,0.055)] transition active:scale-[0.98]">
            <span aria-hidden="true" className="pointer-events-none absolute -right-5 -top-7 h-24 w-24 rounded-full border-[13px] border-[#32134F]/[0.055]" />
            <span className="relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#32134F] text-white"><BriefcaseBusiness className="h-[18px] w-[18px]" /></span>
            <span className="relative block">
              <span className="block text-[13px] font-extrabold leading-tight">Jasa Profesional</span>
              <span className="mt-1 block text-[9px] font-medium text-slate-500">Temukan ahli untuk kebutuhanmu</span>
            </span>
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

      <div className="yuku-home-section"><ProfessionalServicesSection onViewAll={() => onNavigate('/jasa-profesional')} /></div>
      <div className="hidden sm:block yuku-home-section"><EcosystemSection onCommunityClick={() => onNavigate('/komunitas')} onMerchantClick={() => onNavigate('/merchant-partner')} /></div>

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
