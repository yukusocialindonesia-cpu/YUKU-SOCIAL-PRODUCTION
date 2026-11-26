import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Search, ShieldCheck, MapPin, Monitor, ChevronRight, AlertCircle, RefreshCw, Star, BadgeCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppRoute } from '../types/navigation';
import { PROFESSIONAL_SERVICES_CATALOG } from '../data/professionalServicesCatalog';

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  verification_level: string;
  delivery_modes: string[];
}
interface ServiceGroup {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  professional_service_subcategories: ServiceItem[];
}
interface ProviderItem {
  id: string;
  service_description: string;
  rate_amount: number;
  pricing_unit: string;
  delivery_modes: string[];
  provider: { id: string; display_name: string; avatar_url: string; city: string; headline: string; rating_average: number; review_count: number; is_approved: boolean };
  subcategory: { id: string; title: string; category_id: string };
}
interface Props {
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}
const verificationLabel: Record<string, string> = {
  identity: 'Verifikasi identitas',
  reference: 'Identitas & referensi',
  credential: 'Verifikasi kompetensi',
  license: 'Verifikasi izin profesi',
};

export const ProfessionalServicesPage: React.FC<Props> = ({ onNavigate }) => {
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [providerCount, setProviderCount] = useState(0);
  const [loadingMoreProviders, setLoadingMoreProviders] = useState(false);
  const PROVIDER_PAGE_SIZE = 40;
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [mode, setMode] = useState<'all' | 'online' | 'offline'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [providerError, setProviderError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('professional_service_categories')
      .select('id, title, description, icon_name, sort_order, professional_service_subcategories(id, title, description, verification_level, delivery_modes, sort_order)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('sort_order', { referencedTable: 'professional_service_subcategories', ascending: true })
      .eq('professional_service_subcategories.is_active', true);

    // Always show the complete service taxonomy, even before its database migration exists.
    const liveGroups = !fetchError && data?.length ? data as ServiceGroup[] : PROFESSIONAL_SERVICES_CATALOG as ServiceGroup[];
    setGroups(liveGroups);

    const { data: providerData, error: providerFetchError, count: providerTotal } = await supabase
      .from('professional_talent_services')
      .select('id, service_description, rate_amount, pricing_unit, delivery_modes, provider:talent_profiles!inner(id, display_name, avatar_url, city, headline, rating_average, review_count, is_approved), subcategory:professional_service_subcategories!inner(id, title, category_id)', { count: 'exact' })
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, PROVIDER_PAGE_SIZE - 1);

    setProviderError(providerFetchError ? '' : '');
    setProviderCount(providerFetchError ? 0 : (providerTotal || 0));
    const normalized = (providerData || []).map((row: any) => ({
      ...row,
      provider: Array.isArray(row.provider) ? row.provider[0] : row.provider,
      subcategory: Array.isArray(row.subcategory) ? row.subcategory[0] : row.subcategory,
    }));
    setProviders(normalized as ProviderItem[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const loadMoreProviders = async () => {
    if (loadingMoreProviders || providers.length >= providerCount) return;
    setLoadingMoreProviders(true);
    const start = providers.length;
    const { data, error: fetchError } = await supabase
      .from('professional_talent_services')
      .select('id, service_description, rate_amount, pricing_unit, delivery_modes, provider:talent_profiles!inner(id, display_name, avatar_url, city, headline, rating_average, review_count, is_approved), subcategory:professional_service_subcategories!inner(id, title, category_id)')
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, start + PROVIDER_PAGE_SIZE - 1);
    if (fetchError) {
      setProviderError('Halaman penyedia berikutnya gagal dimuat. Coba lagi.');
    } else {
      const normalized = (data || []).map((row: any) => ({
        ...row,
        provider: Array.isArray(row.provider) ? row.provider[0] : row.provider,
        subcategory: Array.isArray(row.subcategory) ? row.subcategory[0] : row.subcategory,
      })) as ProviderItem[];
      setProviders((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...normalized.filter((item) => !existing.has(item.id))];
      });
      setProviderError('');
    }
    setLoadingMoreProviders(false);
  };

  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id');
    return groups
      .filter((group) => selectedGroup === 'all' || group.id === selectedGroup)
      .map((group) => ({
        ...group,
        professional_service_subcategories: (group.professional_service_subcategories || []).filter((item) => {
          const matchesQuery = !normalized || `${group.title} ${item.title} ${item.description}`.toLocaleLowerCase('id').includes(normalized);
          const matchesMode = mode === 'all' || (item.delivery_modes || []).includes(mode);
          return matchesQuery && matchesMode;
        }),
      }))
      .filter((group) => group.professional_service_subcategories.length > 0);
  }, [groups, selectedGroup, mode, query]);

  const totalServices = groups.reduce((total, group) => total + (group.professional_service_subcategories?.length || 0), 0);
  const visibleProviders = providers.filter((item) => {
    const matchesQuery = !query.trim() || `${item.provider.display_name} ${item.provider.headline} ${item.subcategory.title} ${item.provider.city}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id'));
    const matchesCategory = selectedGroup === 'all' || groups.find((g) => g.id === selectedGroup)?.professional_service_subcategories.some((sub) => sub.id === item.subcategory.id);
    const matchesMode = mode === 'all' || (item.delivery_modes || []).includes(mode);
    return matchesQuery && matchesCategory && matchesMode;
  });

  return (
    <div className="min-h-screen bg-[#F8F7FC] pb-10">
      <div className="bg-gradient-to-br from-[#24105F] to-[#5416B8] px-4 pb-7 pt-5 text-white sm:pb-10 sm:pt-8">
        <div className="mx-auto max-w-6xl">
          <button onClick={() => onNavigate('/')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-violet-100 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
          </button>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BriefcaseBusiness className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">YUKU Professional Services</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Jelajahi Jasa Profesional</h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-violet-100 sm:text-sm">Temukan berbagai keahlian dan layanan untuk kebutuhan pribadi, keluarga, perjalanan, hingga bisnis.</p>
              <button onClick={() => onNavigate('/daftar-jasa-profesional')} className="mt-4 rounded-xl bg-white px-4 py-2.5 text-[11px] font-extrabold text-[#24105F] shadow-sm">Daftarkan jasa Anda</button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold text-violet-50">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{groups.length} kategori layanan</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{totalServices} jenis jasa</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5"><ShieldCheck className="h-3 w-3" /> Standar verifikasi</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="-mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_28px_rgba(36,16,95,0.08)] sm:p-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari jasa, contoh: tour guide, perawat, driver..." className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm" />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(['all', 'online', 'offline'] as const).map((value) => (
              <button key={value} onClick={() => setMode(value)} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-bold transition-colors ${mode === value ? 'bg-[#24105F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-50'}`}>
                {value === 'all' ? 'Semua layanan' : value === 'online' ? 'Online' : 'Offline'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setSelectedGroup('all')} className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-bold ${selectedGroup === 'all' ? 'border-violet-700 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'}`}>Semua kategori</button>
          {groups.map((group) => (
            <button key={group.id} onClick={() => setSelectedGroup(group.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-bold ${selectedGroup === group.id ? 'border-violet-700 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'}`}>{group.title}</button>
          ))}
        </div>

        {loading ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
        ) : error ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" /> Data kategori belum bisa dimuat</div>
            <p className="mt-1 text-xs">{error}</p>
            <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white"><RefreshCw className="h-3 w-3" /> Coba lagi</button>
          </div>
         ) : visibleGroups.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Search className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-800">Jasa tidak ditemukan</p>
            <p className="mt-1 text-xs text-slate-500">Coba kata kunci atau filter lainnya.</p>
            <button onClick={() => { setQuery(''); setSelectedGroup('all'); setMode('all'); }} className="mt-3 text-xs font-bold text-violet-700">Reset pencarian</button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {visibleGroups.map((group) => (
              <section key={group.id}>
                <div className="mb-2">
                  <h2 className="text-sm font-extrabold text-slate-900">{group.title}</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">{group.description}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.professional_service_subcategories.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.03)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-[13px] font-bold text-slate-900">{item.title}</h3>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.description}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(item.delivery_modes || []).map((delivery) => <span key={delivery} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">{delivery === 'online' ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{delivery === 'online' ? 'Online' : 'Offline'}</span>)}
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700"><ShieldCheck className="h-3 w-3" />{verificationLabel[item.verification_level] || 'Verifikasi layanan'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {providerError && (
          <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span>{providerError}</span>
            <button onClick={() => void load()} className="rounded-lg bg-amber-900 px-3 py-2 text-[10px] font-bold text-white">Coba lagi</button>
          </div>
        )}

        {visibleProviders.length === 0 && !loading && !providerError && (
          <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-white p-5 text-center">
            <BriefcaseBusiness className="mx-auto h-7 w-7 text-violet-400" />
            <p className="mt-2 text-sm font-extrabold text-slate-800">Penyedia jasa segera hadir</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Kategori dan jenis layanan sudah bisa dijelajahi. Saat ini belum ada penyedia jasa yang aktif dan disetujui untuk ditampilkan.</p>
            <button onClick={() => onNavigate('/daftar-jasa-profesional')} className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 text-[11px] font-bold text-white">Daftarkan jasa Anda</button>
          </div>
        )}

        {visibleProviders.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h2 className="text-sm font-extrabold text-slate-900">Penyedia jasa tersedia</h2><p className="mt-1 text-[11px] text-slate-500">Profil yang sudah disetujui dan aktif di YUKU.</p></div>
              <span className="text-[10px] font-semibold text-slate-500">{visibleProviders.length} layanan</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProviders.map((item) => (
                <button key={item.id} type="button" onClick={() => onNavigate('/jasa-profesional/:id', { id: item.provider.id })} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:shadow-md">
                  <img src={item.provider.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-cover"/>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-xs font-extrabold text-slate-900">{item.provider.display_name}{item.provider.is_approved && <BadgeCheck aria-label="Profil Talent disetujui YUKU" className="h-3 w-3 text-violet-600"/>}</span>
                    <span className="mt-1 block truncate text-[10px] text-slate-500">{item.subcategory.title} · {item.provider.city}</span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Star className="h-3 w-3 text-amber-500"/> {item.provider.review_count > 0 ? `${Number(item.provider.rating_average || 0).toFixed(1)} (${item.provider.review_count} ulasan)` : 'Belum ada ulasan'}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-violet-500"/>
                </button>
              ))}
            </div>
          </section>
        )}

        {providers.length < providerCount && !providerError && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-[10px] text-slate-500">Memuat {providers.length} dari {providerCount} layanan penyedia</p>
            <button type="button" onClick={() => void loadMoreProviders()} disabled={loadingMoreProviders} className="rounded-xl border border-violet-200 bg-white px-5 py-2.5 text-[11px] font-bold text-violet-800 disabled:opacity-50">
              {loadingMoreProviders ? 'Memuat...' : 'Muat penyedia lainnya'}
            </button>
          </div>
        )}
        {providerError && providers.length > 0 && providers.length < providerCount && (
          <div className="mt-3 text-center"><button type="button" onClick={() => void loadMoreProviders()} disabled={loadingMoreProviders} className="text-[11px] font-bold text-violet-700">Coba muat penyedia lainnya</button></div>
        )}

        <div className="mt-7 rounded-2xl border border-violet-100 bg-violet-50 p-4 sm:p-5">
          <p className="text-xs font-extrabold text-violet-950">Layanan sedang dipersiapkan dengan standar keamanan YUKU.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-violet-800">Kategori dan profil penyedia yang telah disetujui dapat dilihat. Fitur pemesanan, jadwal, transaksi, dan pembayaran jasa profesional belum dibuka sampai integrasi serta perlindungan pengguna selesai.</p>
        </div>
      </div>
    </div>
  );
};
