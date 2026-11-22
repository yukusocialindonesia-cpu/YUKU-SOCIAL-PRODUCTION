import React, { useState, useEffect } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { ServiceModeSection } from '../components/home/ServiceModeSection';
import { PromoCarousel } from '../components/home/PromoCarousel';
import { ActivityCategories } from '../components/home/ActivityCategories';
import { FeaturedTalentSection } from '../components/home/FeaturedTalentSection';
import { CommunityPreviewSection } from '../components/home/CommunityPreviewSection';
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

  useEffect(() => {
    let isMounted = true;

    async function loadPromotions() {
      try {
        setIsLoadingPromotions(true);
        const data = await fetchPromotionsFromSupabase();
        if (isMounted) {
          setPromotions(data);
        }
      } catch {
        if (isMounted) {
          setPromotions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPromotions(false);
        }
      }
    }

    loadPromotions();

    return () => {
      isMounted = false;
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
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#FCFBFE]">
      <HeroSection
        onExploreClick={() => onNavigate('/talent')}
        onSearch={handleSearch}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onSlideLinkClick={(path) => onNavigate(path as AppRoute)}
      />

      <ServiceModeSection onSelectMode={(mode) => onNavigate('/talent', { mode })} />

      {/* Talent menjadi fokus utama setelah pengunjung memilih cara layanan. */}
      <FeaturedTalentSection
        onSelectTalent={handleSelectTalent}
        onViewAllClick={() => onNavigate('/talent')}
      />

      <ActivityCategories onSelectCategory={handleSelectCategory} />

      {/* Akses Komunitas ditampilkan langsung di Beranda, tanpa mengubah sistem posting. */}
      <CommunityPreviewSection onOpenCommunity={() => onNavigate('/komunitas')} />

      <PromoCarousel
        promotions={promotions}
        isLoading={isLoadingPromotions}
        onNavigate={onNavigate}
      />

      <HowItWorksSection onLearnMoreClick={() => onNavigate('/cara-kerja')} />

      <SafetySection />

      <TalentCtaSection
        onExploreClick={() => onNavigate('/talent')}
        onRegisterCustomerClick={() => onNavigate('/register')}
        onRegisterClick={() => onNavigate('/daftar-talent')}
      />

      <HomeFaqSection onViewAllFaqClick={() => onNavigate('/faq')} />
    </div>
  );
};
