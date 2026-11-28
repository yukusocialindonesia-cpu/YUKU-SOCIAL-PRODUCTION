import React, { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CalendarDays, CarFront, GraduationCap, HeartHandshake, House, MapPinned, Palette, PawPrint, Sparkles, UserRound, Wrench, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ServiceSubcategory {
  id: string;
  title: string;
  description: string;
  verification_level: string;
  delivery_modes: string[];
}

interface ServiceCategory {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  professional_service_subcategories: ServiceSubcategory[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPinned, HeartHandshake, UserRound, CarFront, House, BriefcaseBusiness,
  Palette, CalendarDays, Sparkles, PawPrint, Wrench, GraduationCap,
};

const verificationLabels: Record<string, string> = {
  identity: 'Verifikasi identitas',
  reference: 'Identitas & referensi',
  credential: 'Pemeriksaan kompetensi',
  license: 'Pemeriksaan izin profesi',
};

export const ProfessionalServicesSection: React.FC<{ onViewAll: () => void }> = ({ onViewAll }) => {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from('professional_service_categories')
        .select('id, title, description, icon_name, professional_service_subcategories(id, title, description, verification_level, delivery_modes)')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!active) return;
      if (error) {
        // Migration may not have been applied yet. Keep the existing homepage healthy.
        console.info('YUKU Professional Services belum tersedia:', error.message);
        setLoaded(true);
        return;
      }

      setCategories((data || []) as ServiceCategory[]);
      setLoaded(true);
    };

    void load();
    return () => { active = false; };
  }, []);

  if (!loaded || categories.length === 0) return null;

  return (
    <section className="bg-white py-7 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#2563EB]">LAYANAN PROFESIONAL</span>
            <h2 className="text-xl font-extrabold tracking-tight text-[#2563EB] sm:text-2xl">Jasa Profesional</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500 sm:text-sm">Temukan tenaga ahli dan layanan terpercaya untuk kebutuhan sehari-hari maupun profesional.</p>
          </div>
          <button type="button" onClick={onViewAll} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F5F8FC] px-3 py-2 text-[10px] font-bold text-[#2563EB] transition hover:bg-[#2563EB]/10 sm:text-[11px]">Lihat semua <ArrowRight className="h-3 w-3" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = iconMap[category.icon_name] || BriefcaseBusiness;
            const expanded = expandedId === category.id;
            return (
              <article key={category.id} className={`overflow-hidden rounded-2xl border bg-white transition-colors ${expanded ? 'border-[#2563EB]/35 shadow-md shadow-[#2563EB]/[0.06]' : 'border-slate-200'}`}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : category.id)}
                  className="flex min-h-[112px] w-full flex-col items-start justify-between gap-3 p-3 text-left sm:min-h-[124px] sm:p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F8FC] text-[#2563EB]">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-[12px] font-bold leading-snug text-[#2563EB] sm:text-sm">{category.title}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {expanded && (
                  <div className="border-t border-[#2563EB]/10 bg-[#F5F8FC] px-3 py-3 sm:px-4">
                    <p className="mb-2 text-[11px] leading-relaxed text-slate-600">{category.description}</p>
                    <ul className="space-y-2">
                      {(category.professional_service_subcategories || []).map((service) => (
                        <li key={service.id} className="border-t border-[#2563EB]/10 pt-2 first:border-0 first:pt-0">
                          <p className="text-xs font-semibold text-[#2563EB]">{service.title}</p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{service.description}</p>
                          <p className="mt-1 text-[10px] font-medium text-[#2563EB]">{verificationLabels[service.verification_level] || 'Verifikasi sesuai layanan'}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                      Detail pemesanan segera tersedia <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
