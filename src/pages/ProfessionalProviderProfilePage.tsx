import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, CalendarDays, MapPin, Monitor, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppRoute } from '../types/navigation';
import { formatProfessionalRate } from '../lib/professionalServicePricing';

interface Props {
  providerId: string;
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}
interface ProviderService {
  id: string;
  service_description: string;
  experience_years: number;
  service_city: string | null;
  delivery_modes: string[];
  rate_amount: number;
  pricing_unit: string;
  subcategory: { id: string; title: string; description: string; verification_level: string; category: { title: string } };
}
interface ProviderProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  is_profile_complete: boolean;
}
const verificationLabel: Record<string, string> = { identity: 'Standar pemeriksaan identitas', reference: 'Standar pemeriksaan referensi', credential: 'Standar pemeriksaan kompetensi', license: 'Wajib pemeriksaan izin profesi' };

export const ProfessionalProviderProfilePage: React.FC<Props> = ({ providerId, onNavigate }) => {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: queryError } = await supabase
        .from('professional_talent_services')
        .select('id, service_description, experience_years, service_city, delivery_modes, rate_amount, pricing_unit, subcategory:professional_service_subcategories!inner(id, title, description, verification_level, category:professional_service_categories!inner(title)), provider:professional_provider_profiles!inner(user_id, display_name, avatar_url, city, headline, bio, is_profile_complete)')
        .eq('provider_id', providerId)
        .eq('provider.is_profile_complete', true)
        .eq('approval_status', 'approved')
        .eq('is_active', true);

      if (!mounted) return;
      if (queryError) {
        setError('Profil jasa belum tersedia. Pastikan migrasi layanan profesional sudah diterapkan.');
        setProfile(null);
        setServices([]);
      } else if (!data || data.length === 0) {
        setError('Profil penyedia tidak ditemukan atau belum lolos persetujuan YUKU.');
        setProfile(null);
        setServices([]);
      } else {
        const first = data[0] as any;
        const provider = Array.isArray(first.provider) ? first.provider[0] : first.provider;
        setProfile(provider || null);
        setServices(data.map((row: any) => ({
          id: row.id,
          service_description: row.service_description,
          experience_years: row.experience_years,
          service_city: row.service_city,
          delivery_modes: row.delivery_modes || [],
          rate_amount: Number(row.rate_amount),
          pricing_unit: row.pricing_unit,
          subcategory: Array.isArray(row.subcategory) ? row.subcategory[0] : row.subcategory,
        })));
      }
      setLoading(false);
    };
    if (providerId) void load();
    else { setError('ID penyedia tidak valid.'); setLoading(false); }
    return () => { mounted = false; };
  }, [providerId]);

  if (loading) return <div className="min-h-[60vh] bg-[#F8F7FC] p-5"><div className="mx-auto max-w-4xl animate-pulse space-y-4"><div className="h-8 w-32 rounded bg-slate-200"/><div className="h-52 rounded-3xl bg-slate-200"/><div className="h-36 rounded-3xl bg-slate-200"/></div></div>;

  if (error || !profile) return (
    <div className="min-h-[65vh] bg-[#F8F7FC] px-4 py-8">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-500"/>
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">Profil belum tersedia</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button onClick={() => onNavigate('/jasa-profesional')} className="mt-5 rounded-xl bg-[#24105F] px-4 py-2.5 text-xs font-bold text-white">Kembali ke Jelajahi Jasa</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F7FC] pb-12">
      <div className="bg-gradient-to-br from-[#24105F] to-[#5416B8] px-4 pb-10 pt-5 text-white">
        <div className="mx-auto max-w-4xl">
          <button onClick={() => onNavigate('/jasa-profesional')} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-violet-100"><ArrowLeft className="h-4 w-4"/> Kembali ke jasa profesional</button>
          <div className="flex items-center gap-4">
            <img src={profile.avatar_url} alt={profile.display_name} className="h-20 w-20 rounded-2xl border-2 border-white/40 bg-white/10 object-cover sm:h-24 sm:w-24"/>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold sm:text-2xl">{profile.display_name}</h1>
                {profile.is_profile_complete && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold"><BadgeCheck className="h-3 w-3"/> Profil profesional lengkap</span>}
              </div>
              <p className="mt-1 text-xs text-violet-100">{profile.headline || 'Penyedia jasa profesional'}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-violet-100"><MapPin className="h-3 w-3"/>{profile.city || 'Lokasi belum dicantumkan'}</p>
            </div>
          </div>

        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl space-y-4 px-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-900">Tentang penyedia</h2>
          <p className="mt-2 whitespace-pre-line text-xs leading-6 text-slate-600">{profile.bio || 'Penyedia belum menambahkan deskripsi.'}</p>

        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">Layanan yang ditawarkan</h2>
            <span className="text-[10px] font-semibold text-slate-500">{services.length} layanan disetujui</span>
          </div>
          {services.map((service) => (
            <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">{service.subcategory?.category?.title || 'Jasa profesional'}</p>
                  <h3 className="mt-1 text-base font-extrabold text-slate-900">{service.subcategory?.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{service.service_description || service.subcategory?.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-slate-500">Tarif</p>
                  <p className="text-sm font-extrabold text-[#24105F]">{formatProfessionalRate(service.rate_amount, service.pricing_unit)}</p>
                  
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {service.service_city && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600"><MapPin className="h-3 w-3"/>{service.service_city}</span>}
                {service.delivery_modes.map((mode) => <span key={mode} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600">{mode === 'online' ? <Monitor className="h-3 w-3"/> : <MapPin className="h-3 w-3"/>}{mode === 'online' ? 'Online' : 'Offline'}</span>)}
                {service.experience_years > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600"><CalendarDays className="h-3 w-3"/>{service.experience_years} tahun pengalaman</span>}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-[10px] leading-relaxed text-violet-800"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{verificationLabel[service.subcategory?.verification_level] || 'Persyaratan verifikasi mengikuti jenis layanan.'}. Status profil profesional dan persetujuan listing bukan bukti bahwa sertifikat atau izin profesi telah diverifikasi oleh instansi penerbit.</div>
            </article>
          ))}
        </section>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
          <strong>Pemesanan belum dibuka.</strong> YUKU masih menyiapkan alur pemeriksaan dokumen, jadwal, transaksi, dan perlindungan pengguna untuk kategori jasa profesional.
        </div>
      </div>
    </div>
  );
};
