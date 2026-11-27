import { supabase } from '../lib/supabase';
import { TalentProfile, ActivityCategory, ActivityCategoryId } from '../types/talent';
import { PromotionRow, HeroSlideRow } from '../types/database';

/**
 * Safely map database row from talent_profiles table to TalentProfile frontend interface.
 * Strictly uses nullish checking (== null) to preserve numeric 0 and NULL values without inventing fake defaults.
 */
export function mapSupabaseTalent(row: any, servicesCategoryIds: string[] = [], serviceOffers: { id: string; categoryId: string; title: string; description: string }[] = []): TalentProfile {
  if (!row) {
    throw new Error('Data baris talent_profiles bernilai null atau tidak valid.');
  }

  return {
    id: row.id,
    name: row.display_name ?? '',
    createdAt: row.created_at ?? undefined,
    city: row.city ?? '',
    gender: row.gender === 'Pria' ? 'Pria' : row.gender === 'Wanita' ? 'Wanita' : undefined,
    headline: row.headline ?? '',
    bio: row.bio ?? '',
    rating: row.rating_average == null ? undefined : Number(row.rating_average),
    reviewCount: row.review_count == null ? undefined : Number(row.review_count),
    completedHours: row.completed_hours == null ? undefined : Number(row.completed_hours),
    avatarUrl: row.avatar_url ?? '',
    activities: servicesCategoryIds as ActivityCategoryId[],
    serviceOffers,
    hourlyRate: row.hourly_rate == null ? undefined : Number(row.hourly_rate),
    onlineChatRate: row.online_chat_rate == null ? undefined : Number(row.online_chat_rate),
    languages: Array.isArray(row.languages) ? row.languages : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    serviceMode: row.service_mode ?? '',
    // is_approved is set by the admin approval flow, which requires verified KTP.
    isVerified: row.is_approved === true,
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
// Share one in-flight category request across homepage/search/page components.
// This prevents parallel duplicate requests from showing conflicting UI states.
let categoriesRequest: Promise<ActivityCategory[]> | null = null;

export function fetchCategoriesFromSupabase(): Promise<ActivityCategory[]> {
  if (categoriesRequest) return categoriesRequest;

  const request = (async () => {
    let lastError: unknown;

    // Retry once only for browser-level network failures (for example, "Failed to fetch").
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from('activity_categories')
          .select('id, title, description, icon_name, examples, is_online_available, is_active')
          .eq('is_active', true);

        if (error) {
          const fetchError = new Error(
            `Gagal membaca kategori dari Supabase: ${error.message} (${error.code || 'UNKNOWN'})`
          );
          if (attempt === 0 && /failed to fetch|networkerror|fetch failed/i.test(error.message)) {
            lastError = fetchError;
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            continue;
          }
          throw fetchError;
        }

        return (data || []).map(mapSupabaseCategory);
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        if (attempt === 0 && /failed to fetch|networkerror|fetch failed/i.test(message)) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          continue;
        }
        throw err;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Gagal membaca kategori dari Supabase: kegagalan jaringan (UNKNOWN)');
  })();

  categoriesRequest = request;
  const clearRequest = () => {
    if (categoriesRequest === request) categoriesRequest = null;
  };
  void request.then(clearRequest, clearRequest);

  return request;
}

/**
 * Fetch public talent profiles from Supabase talent_profiles table via SELECT.
 * Explicitly checks errors on both talent_profiles and talent_services queries to prevent masking failures.
 */
async function fetchTalentsOnce(limit?: number, offset = 0, searchTerm = ''): Promise<TalentProfile[]> {
  let query = supabase
    .from('talent_profiles')
    .select(
      'id, display_name, avatar_url, city, gender, headline, bio, hourly_rate, online_chat_rate, service_mode, rating_average, review_count, completed_hours, languages, interests, is_approved, created_at'
    )
    // Prioritaskan status verifikasi, bukti ulasan, kualitas rating, dan pengalaman.
    // Tanggal pendaftaran menjadi penentu terakhir agar urutan tetap konsisten.
    .order('is_approved', { ascending: false })
    .order('review_count', { ascending: false })
    .order('rating_average', { ascending: false })
    .order('completed_hours', { ascending: false })
    .order('created_at', { ascending: false })
    // Tie-breaker stabil agar pagination tidak mengulang/melewatkan baris dengan nilai urutan sama.
    .order('id', { ascending: true });

  // Search di server agar hasil tidak terbatas pada batch yang sudah dimuat browser.
  const normalizedSearch = searchTerm.trim();
  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/["\\]/g, '\\$&');
    const pattern = '"%' + escapedSearch + '%"';
    query = query.or(
      'display_name.ilike.' + pattern + ',headline.ilike.' + pattern + ',bio.ilike.' + pattern
    );
  }

  if (limit !== undefined) {
    const safeLimit = Math.max(1, Math.floor(limit));
    const safeOffset = Math.max(0, Math.floor(offset));
    query = query.range(safeOffset, safeOffset + safeLimit - 1);
  }

  const { data: talentsData, error: talentsError } = await query;

  if (talentsError) {
    throw new Error(`Gagal membaca daftar Talent dari Supabase: ${talentsError.message} (${talentsError.code || 'UNKNOWN'})`);
  }

  if (!talentsData || talentsData.length === 0) {
    return [];
  }

  // Fetch talent_services to map category IDs with explicit error checking
  const talentIds = talentsData.map((t) => t.id);
  const { data: servicesData, error: servicesError } = await supabase
    .from('talent_services')
    .select('id, talent_id, activity_category_id, custom_title, custom_description, approval_status, is_active')
    .in('talent_id', talentIds);

  if (servicesError) {
    throw new Error(`Gagal membaca layanan Talent dari Supabase: ${servicesError.message} (${servicesError.code || 'UNKNOWN'})`);
  }

  const servicesMap = new Map<string, string[]>();
  const offersMap = new Map<string, { id: string; categoryId: string; title: string; description: string }[]>();
  if (servicesData) {
    servicesData.filter((s) => s.approval_status === 'approved' && s.is_active).forEach((s) => {
      const existing = servicesMap.get(s.talent_id) || [];
      existing.push(s.activity_category_id);
      servicesMap.set(s.talent_id, existing);
      if (s.approval_status === 'approved' && s.is_active && s.custom_title) {
        const offers = offersMap.get(s.talent_id) || [];
        offers.push({ id: s.id, categoryId: s.activity_category_id, title: s.custom_title, description: s.custom_description || '' });
        offersMap.set(s.talent_id, offers);
      }
    });
  }

  return talentsData.map((row) =>
    mapSupabaseTalent(row, servicesMap.get(row.id) || [], offersMap.get(row.id) || [])
  );
}


/**
 * Share identical in-flight Talent list requests and retry once on transient
 * browser/network failures. This avoids competing requests from homepage,
 * search, and browse components while preserving real query errors.
 */
const talentListRequests = new Map<string, Promise<TalentProfile[]>>();

export function fetchTalentsFromSupabase(limit?: number, offset = 0, searchTerm = ''): Promise<TalentProfile[]> {
  const requestKey = JSON.stringify([limit ?? null, offset, searchTerm.trim()]);
  const existingRequest = talentListRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await fetchTalentsOnce(limit, offset, searchTerm);
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const isNetworkFailure = /failed to fetch|networkerror|fetch failed|load failed/i.test(message);
        if (attempt === 0 && isNetworkFailure) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Gagal membaca daftar Talent dari Supabase: kegagalan jaringan (UNKNOWN)');
  })();

  talentListRequests.set(requestKey, request);
  const clearRequest = () => {
    if (talentListRequests.get(requestKey) === request) {
      talentListRequests.delete(requestKey);
    }
  };
  void request.then(clearRequest, clearRequest);
  return request;
}

/**
 * Fetch a targeted set of public Talent profiles by ID.
 * Used by GPS discovery so nearby profiles are not missed by the first catalog page.
 */
export async function fetchTalentsByIdsFromSupabase(talentIds: string[], searchTerm = ''): Promise<TalentProfile[]> {
  const uniqueIds = [...new Set(talentIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (uniqueIds.length === 0) return [];

  let query = supabase
    .from('talent_profiles')
    .select(
      'id, display_name, avatar_url, city, gender, headline, bio, hourly_rate, online_chat_rate, service_mode, rating_average, review_count, completed_hours, languages, interests, is_approved, created_at'
    )
    .in('id', uniqueIds);

  const normalizedSearch = searchTerm.trim();
  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/["\\]/g, '\\$&');
    const pattern = '"%' + escapedSearch + '%"';
    query = query.or(
      'display_name.ilike.' + pattern + ',headline.ilike.' + pattern + ',bio.ilike.' + pattern
    );
  }

  const { data: talentsData, error: talentsError } = await query;
  if (talentsError) {
    throw new Error(`Gagal membaca Talent terdekat dari Supabase: ${talentsError.message} (${talentsError.code || 'UNKNOWN'})`);
  }
  if (!talentsData || talentsData.length === 0) return [];

  const { data: servicesData, error: servicesError } = await supabase
    .from('talent_services')
    .select('id, talent_id, activity_category_id, custom_title, custom_description, approval_status, is_active')
    .in('talent_id', talentsData.map((talent) => talent.id));

  if (servicesError) {
    throw new Error(`Gagal membaca layanan Talent terdekat: ${servicesError.message} (${servicesError.code || 'UNKNOWN'})`);
  }

  const servicesMap = new Map<string, string[]>();
  const offersMap = new Map<string, { id: string; categoryId: string; title: string; description: string }[]>();
  (servicesData || []).filter((service) => service.approval_status === 'approved' && service.is_active).forEach((service) => {
    const existing = servicesMap.get(service.talent_id) || [];
    existing.push(service.activity_category_id);
    servicesMap.set(service.talent_id, existing);
    if (service.custom_title) {
      const offers = offersMap.get(service.talent_id) || [];
      offers.push({ id: service.id, categoryId: service.activity_category_id, title: service.custom_title, description: service.custom_description || '' });
      offersMap.set(service.talent_id, offers);
    }
  });

  return talentsData.map((row) => mapSupabaseTalent(row, servicesMap.get(row.id) || [], offersMap.get(row.id) || []));
}

/**
 * Fetch a single talent profile by ID from Supabase talent_profiles table via SELECT.
 * Explicitly checks errors on both talent_profiles and talent_services queries to prevent masking failures.
 */
export async function fetchTalentByIdFromSupabase(talentId: string): Promise<TalentProfile | null> {
  const { data, error } = await supabase
    .from('talent_profiles')
    .select(
      'id, display_name, avatar_url, city, gender, headline, bio, hourly_rate, online_chat_rate, service_mode, rating_average, review_count, completed_hours, languages, interests, is_approved, created_at'
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
    .select('id, activity_category_id, custom_title, custom_description, approval_status, is_active')
    .eq('talent_id', talentId);

  if (servicesError) {
    throw new Error(`Gagal membaca layanan Talent (${talentId}) dari Supabase: ${servicesError.message} (${servicesError.code || 'UNKNOWN'})`);
  }

  const approvedServices = (servicesData || []).filter((s) => s.approval_status === 'approved' && s.is_active);
  const categoryIds = approvedServices.map((s) => s.activity_category_id);
  const offers = approvedServices.filter((s) => s.custom_title).map((s) => ({
    id: s.id,
    categoryId: s.activity_category_id,
    title: s.custom_title,
    description: s.custom_description || '',
  }));

  return mapSupabaseTalent(data, categoryIds, offers);
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

  if (error) throw error;
  return (data as HeroSlideRow[]) || [];
}
