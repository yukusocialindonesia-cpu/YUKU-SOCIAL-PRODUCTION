import type { ActivityCategory, TalentProfile } from '../types/talent';
import type { PromotionRow, HeroSlideRow } from '../types/database';

/** True only in an explicitly enabled Cloudflare/GitHub preview build. */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const timestamp = '2026-01-01T00:00:00.000Z';

export const demoCategories: ActivityCategory[] = [
  { id: 'ngopi-makan', title: 'Ngopi & Kuliner', description: 'Teman menikmati kopi dan kuliner.', iconName: 'Coffee', examples: ['Ngopi', 'Kulineran'], isOnlineAvailable: false },
  { id: 'olahraga', title: 'Olahraga', description: 'Teman bergerak dan berolahraga.', iconName: 'Users', examples: ['Jogging', 'Badminton'], isOnlineAvailable: false },
  { id: 'nonton-hiburan', title: 'Nonton & Hiburan', description: 'Teman menikmati hiburan.', iconName: 'Film', examples: ['Bioskop', 'Konser'], isOnlineAvailable: false },
  { id: 'belanja', title: 'Belanja', description: 'Teman menemani berbelanja.', iconName: 'ShoppingBag', examples: ['Mall', 'Window shopping'], isOnlineAvailable: false },
  { id: 'jalan-jalan', title: 'Jalan-jalan', description: 'Teman menjelajahi tempat baru.', iconName: 'Sparkles', examples: ['Wisata kota', 'Museum'], isOnlineAvailable: false },
  { id: 'teman-cerita', title: 'Teman Cerita', description: 'Teman untuk berbincang santai.', iconName: 'MessageCircle', examples: ['Ngobrol', 'Berbagi cerita'], isOnlineAvailable: true },
];

export const demoTalents: TalentProfile[] = [
  { id: 'demo-talent-01', name: 'Nadia', age: 24, city: 'Bogor', gender: 'Wanita', headline: 'Teman ngopi dan eksplor tempat baru', bio: 'Suka mencoba coffee shop, kuliner, dan tempat menarik.', rating: 4.9, reviewCount: 28, completedHours: 46, avatarUrl: 'https://i.pravatar.cc/480?img=47', activities: ['ngopi-makan', 'jalan-jalan', 'teman-cerita'], hourlyRate: 75000, onlineChatRate: 35000, languages: ['Indonesia', 'English'], interests: ['Coffee shop', 'Kuliner', 'Travel'], serviceMode: 'Offline & Online', isDemo: true, createdAt: timestamp, isVerified: true },
  { id: 'demo-talent-02', name: 'Raka', age: 26, city: 'Jakarta Selatan', gender: 'Pria', headline: 'Teman olahraga dan aktivitas outdoor', bio: 'Senang jogging, badminton, dan aktivitas luar ruang.', rating: 4.8, reviewCount: 19, completedHours: 32, avatarUrl: 'https://i.pravatar.cc/480?img=12', activities: ['olahraga', 'jalan-jalan'], hourlyRate: 85000, languages: ['Indonesia'], interests: ['Jogging', 'Badminton', 'Hiking'], serviceMode: 'Offline Only', isDemo: true, createdAt: timestamp, isVerified: true },
  { id: 'demo-talent-03', name: 'Alya', age: 23, city: 'Depok', gender: 'Wanita', headline: 'Teman nonton, belanja, dan kulineran', bio: 'Ramah dan suka menemukan pengalaman baru.', rating: 5.0, reviewCount: 14, completedHours: 21, avatarUrl: 'https://i.pravatar.cc/480?img=44', activities: ['nonton-hiburan', 'belanja', 'ngopi-makan'], hourlyRate: 70000, languages: ['Indonesia', 'English'], interests: ['Film', 'Fashion', 'Dessert'], serviceMode: 'Offline & Online', isDemo: true, createdAt: timestamp, isVerified: true },
  { id: 'demo-talent-04', name: 'Dimas', age: 27, city: 'Bandung', gender: 'Pria', headline: 'Teman ngobrol dan city exploring', bio: 'Suka musik, fotografi, dan jalan santai.', rating: 4.9, reviewCount: 31, completedHours: 58, avatarUrl: 'https://i.pravatar.cc/480?img=13', activities: ['teman-cerita', 'jalan-jalan', 'nonton-hiburan'], hourlyRate: 80000, onlineChatRate: 30000, languages: ['Indonesia'], interests: ['Musik', 'Fotografi', 'City walk'], serviceMode: 'Offline & Online', isDemo: true, createdAt: timestamp, isVerified: true },
  { id: 'demo-talent-05', name: 'Salsa', age: 25, city: 'Tangerang', gender: 'Wanita', headline: 'Teman hangout dan wisata kuliner', bio: 'Suka berburu makanan enak dan tempat estetik.', rating: 4.8, reviewCount: 22, completedHours: 37, avatarUrl: 'https://i.pravatar.cc/480?img=49', activities: ['ngopi-makan', 'jalan-jalan', 'belanja'], hourlyRate: 75000, languages: ['Indonesia'], interests: ['Kuliner', 'Cafe hopping', 'Shopping'], serviceMode: 'Offline Only', isDemo: true, createdAt: timestamp, isVerified: true },
  { id: 'demo-talent-06', name: 'Kevin', age: 25, city: 'Jakarta Pusat', gender: 'Pria', headline: 'Teman diskusi dan pecinta film', bio: 'Senang ngobrol santai, film, dan event kreatif.', rating: 4.9, reviewCount: 17, completedHours: 29, avatarUrl: 'https://i.pravatar.cc/480?img=14', activities: ['teman-cerita', 'nonton-hiburan'], hourlyRate: 80000, onlineChatRate: 30000, languages: ['Indonesia', 'English'], interests: ['Film', 'Diskusi', 'Event'], serviceMode: 'Offline & Online', isDemo: true, createdAt: timestamp, isVerified: true },
];

export const demoPromotions: PromotionRow[] = [];
export const demoHeroSlides: HeroSlideRow[] = [];
