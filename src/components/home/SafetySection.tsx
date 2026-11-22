import React from 'react';
import { ShieldCheck, Ban, UserCheck, MapPin } from 'lucide-react';

const GUIDELINES = [
  {
    Icon: Ban,
    title: 'Pertemanan Positif',
    description: 'YUKU berfokus pada teman aktivitas dan interaksi sosial. Layanan kencan maupun permintaan seksual bukan bagian dari layanan YUKU.',
  },
  {
    Icon: UserCheck,
    title: 'Untuk Pengguna 18+',
    description: 'YUKU ditujukan untuk pengguna berusia 18 tahun ke atas. Ikuti proses verifikasi identitas yang diminta saat menggunakan layanan.',
  },
  {
    Icon: MapPin,
    title: 'Pilih Lokasi Terbuka',
    description: 'Untuk aktivitas offline, sepakati lokasi yang terbuka dan ramai seperti kafe, pusat perbelanjaan, atau tempat publik lainnya.',
  },
];

export const SafetySection: React.FC = () => {
  return (
    <section className="bg-[#F7F5FA] py-7 text-slate-900 sm:py-11">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 max-w-2xl sm:mb-6">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700">
            <ShieldCheck className="h-4 w-4" />
            Panduan Penggunaan
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Berinteraksi dengan Nyaman dan Aman
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Beberapa panduan sederhana untuk menjaga pengalaman positif saat menggunakan YUKU.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {GUIDELINES.map(({ Icon, title, description }) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
