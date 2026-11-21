import { supabase } from '../lib/supabase';
import { TalentProfile, ActivityCategory, ActivityCategoryId } from '../types/talent';
import { PromotionRow, HeroSlideRow } from '../types/database';

/**
 * Safely map database row from talent_profiles table to TalentProfile frontend interface.
 * Strictly uses nullish checking (== null) to preserve numeric 0 and NULL values without inventing fake defaults.
 */
const HOME_DATA_CACHE_MS = 60_000;
let categoriesCache: { at: number; value: ActivityCategory[] } | null = null;
let categoriesRequest: Promise<ActivityCategory[]> | null = null;
let talentsCache: { at: number; value: TalentProfile[] } | null = null;
let talentsRequest: Promise<TalentProfile[]> | null = null;

export function mapSupabaseTalent(row: any, servicesCategoryIds: string[] = [], mediaTypes: string[] = []): TalentProfile {
  if (!row) {
    throw new Error('Data baris talent_profiles bernilai null atau tidak valid.');
  }

  return {
    id: row.id,
    name: row.display_name ?? '',
    city: row.city ?? '',
    gender: row.gender === 'Pria' ? 'Pria' : row.gender === 'Wanita' ? 'Wanita' : undefined,
    headline: row.headline ?? '',
    bio: row.bio ?? '',
    rating: row.rating_average == null ? undefined : Number(row.rating_average),
    reviewCount: row.review_count == null ? undefined : Number(row.review_count),
    completedHours: row.completed_hours == null ? undefined : Number(row.completed_hours),
    avatarUrl: row.avatar_url ?? '',
    activities: servicesCategoryIds as ActivityCategoryId[],
    hourlyRate: row.hourly_rate == null ? undefined : Number(row.hourly_rate),
    onlineChatRate: row.online_chat_rate == null ? undefined : Number(row.online_chat_rate),
    languages: Array.isArray(row.languages) ? row.languages : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    serviceMode: row.service_mode ?? '',
    mediaTypes,
  };
}

/**
 * Safely map database row from activity_categories table to ActivityCategory frontend interface.
 */
export function mapSupabaseCategory(row: any): ActivityCategory {
  if (!row) {
    throw new Error('Data baris activity_categories bernilai null atau tidak valid.');
  }

  return {
    id: row.id as ActivityCategoryId,
    title: row.title ?? row.id,
    description: row.description ?? '',
    iconName: row.icon_name ?? '',
    examples: Array.isArray(row.examples) ? row.examples : [],
    isOnlineAvailable: Boolean(row.is_online_available),
  };
}

/**
 * Fetch all active activity categories from Supabase activity_categories table via SELECT.
 * Throws errors explicitly on failure without disguising query failures as empty state.
 */
export async function fetchCategoriesFromSupabase(): Promise<ActivityCategory[]> {
  if (categoriesCache && Date.now() - categoriesCache.at < HOME_DATA_CACHE_MS) return categoriesCache.value;
  if (categoriesRequest) return categoriesRequest;
  categoriesRequest = (async () => {
    const { data, error } = await supabase
      .from('activity_categories')
      .select('id, title, description, icon_name, examples, is_online_available, is_active')
      .eq('is_active', true);
    if (error) throw new Error(`Gagal membaca kategori dari Supabase: ${error.message} (${error.code || 'UNKNOWN'})`);
    const value = (data || []).map(mapSupabaseCategory);
    categoriesCache = { at: Date.now(), value };
    return value;
  })();
  try { return await categoriesRequest; } finally { categoriesRequest = null; }
}

/**
 * Fetch public talent profiles from Supabase talent_profiles table via SELECT.
 * Explicitly checks errors on both talent_profiles and talent_services queries to prevent masking failures.
 */
export async function fetchTalentsFromSupabase(limit?: number): Promise<TalentProfile[]> {
  let all: TalentProfile[];
  if (talentsCache && Date.now() - talentsCache.at < HOME_DATA_CACHE_MS) {
    all = talentsCache.value;
  } else if (talentsRequest) {
    all = await talentsRequest;
  } else {
    talentsRequest = (async () => {
      const { data: talentsData, error: talentsError } = await supabase
        .from('talent_profiles')
        .select('id, display_name, avatar_url, city, gender, headline, bio, hourly_rate, online_chat_rate, service_mode, rating_average, review_count, completed_hours, languages, interests');
      if (talentsError) throw new Error(`Gagal membaca daftar Talent dari Supabase: ${talentsError.message} (${talentsError.code || 'UNKNOWN'})`);
      if (!talentsData?.length) return [];
      const talentIds = talentsData.map((t) => t.id);
      const [servicesResult, mediaResult] = await Promise.all([
        supabase.from('talent_services').select('talent_id, activity_category_id').in('talent_id', talentIds),
        supabase.from('talent_media').select('talent_id, media_type').in('talent_id', talentIds),
      ]);
      if (servicesResult.error) throw new Error(`Gagal membaca layanan Talent dari Supabase: ${servicesResult.error.message} (${servicesResult.error.code || 'UNKNOWN'})`);
      // Media indicators are optional; if the query fails, keep cards usable without badges.
      const servicesMap = new Map<string, string[]>();
      (servicesResult.data || []).forEach((s) => { const list=servicesMap.get(s.talent_id)||[]; list.push(s.activity_category_id); servicesMap.set(s.talent_id,list); });
      const mediaMap = new Map<string, string[]>();
      (mediaResult.data || []).forEach((m) => { const list=mediaMap.get(m.talent_id)||[]; list.push(String(m.media_type)); mediaMap.set(m.talent_id,list); });
      const value = talentsData.map((row) => mapSupabaseTalent(row, servicesMap.get(row.id)||[], Array.from(new Set(mediaMap.get(row.id)||[]))));
      talentsCache = { at: Date.now(), value };
      return value;
    })();
    try { all = await talentsRequest; } finally { talentsRequest = null; }
  }
  return limit ? all.slice(0, limit) : all;
}

/**
 * Fetch a single talent profile by ID from Supabase talent_profiles table via SELECT.
 * Explicitly checks errors on both talent_profiles and talent_services queries to prevent masking failures.
 */
export async function fetchTalentByIdFromSupabase(talentId: string): Promise<TalentProfile | null> {
  const { data, error } = await supabase
    .from('talent_profiles')
    .select(
      'id, display_name, avatar_url, city, gender, headline, bio, hourly_rate, online_chat_rate, service_mode, rating_average, review_count, completed_hours, languages, interests'
    )
    .eq('id', talentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal membaca detail Talent (${talentId}) dari Supabase: ${error.message} (${error.code || 'UNKNOWN'})`);
  }

  if (!data) {
    return null;
  }

  // Fetch services for this talent with explicit error checking
  const { data: servicesData, error: servicesError } = await supabase
    .from('talent_services')
    .select('activity_category_id')
    .eq('talent_id', talentId);

  if (servicesError) {
    throw new Error(`Gagal membaca layanan Talent (${talentId}) dari Supabase: ${servicesError.message} (${servicesError.code || 'UNKNOWN'})`);
  }

  const categoryIds = servicesData ? servicesData.map((s) => s.activity_category_id) : [];

  return mapSupabaseTalent(data, categoryIds);
}

/**
 * Fetch active promotional slides from Supabase promotions table via SELECT.
 */
export async function fetchPromotionsFromSupabase(): Promise<PromotionRow[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('id, title, image_url, link_url, storage_path, sort_order, is_active, created_by, created_at, updated_at')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal membaca data promosi dari Supabase: ${error.message} (${error.code || 'UNKNOWN'})`);
  }

  return (data as PromotionRow[]) || [];
}

/**
 * Ambil slide hero Beranda yang aktif (diurutkan sort_order).
 * Jika tabel belum dimigrasi atau kosong, mengembalikan array kosong
 * sehingga Beranda memakai hero bawaan.
 */
export async function fetchHeroSlidesFromSupabase(): Promise<HeroSlideRow[]> {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('id, title, image_url, mobile_image_url, link_url, storage_path, mobile_storage_path, sort_order, is_active, created_by, created_at, updated_at')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data as HeroSlideRow[]) || [];
}
