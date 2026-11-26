/**
 * Talent and Activity Types for YUKU
 */

export type ActivityCategoryId = string;

export interface ActivityCategory {
  id: ActivityCategoryId;
  title: string;
  description: string;
  iconName: string;
  examples: string[];
  isOnlineAvailable: boolean;
}

export type GenderType = 'Pria' | 'Wanita' | 'Semua';

export interface TalentServiceOffer {
  categoryId: ActivityCategoryId;
  title: string;
  description: string;
}

export interface TalentProfile {
  id: string;
  name: string;
  age?: number;
  city?: string;
  /** Approximate straight-line distance from the Customer's current location, in km. */
  distanceKm?: number;
  gender?: 'Pria' | 'Wanita';
  headline?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
  completedHours?: number;
  avatarUrl?: string;
  activities: ActivityCategoryId[];
  serviceOffers?: TalentServiceOffer[];
  hourlyRate?: number;
  onlineChatRate?: number;
  languages?: string[];
  interests?: string[];
  serviceMode?: 'Offline & Online' | 'Offline Only' | 'Online Only' | string;
  isDemo?: boolean;
  /** Registration timestamp used to determine whether the talent is newly registered. */
  createdAt?: string;
  /** True only when YUKU admin has approved the talent after identity verification. */
  isVerified?: boolean;
}

export interface Testimonial {
  id: string;
  author: string;
  city: string;
  activity: string;
  quote: string;
  date: string;
  rating: number;
  isDemo?: boolean;
}
