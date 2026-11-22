import React from 'react';
import { ShieldCheck, Ban, UserCheck, MapPin } from 'lucide-react';

const GUIDELINES = [
  {
    Icon: Ban,
    title: 'Untuk Pertemanan Positif',
    description: 'YUKU berfokus pada teman aktivitas dan interaksi sosial. Layanan kencan maupun permintaan seksual bukan bagian dari layanan YUKU.',
  },
  {
    Icon: UserCheck,
    title: 'Khusus Pengguna Dewasa',
    description: 'YUKU ditujukan untuk pengguna berusia 18 tahun ke atas. Ikuti proses verifikasi identitas yang diminta saat menggunakan layanan.',
  },
  {
    Icon: MapPin,
    title: 'Utamakan Tempat Umum',
    description: 'Saat memilih aktivitas offline, sepakati lokasi yang terbuka dan ramai seperti kafe, pusat perbelanjaan, atau tempat publik lainnya.',
  },
];

export const SafetySection: React.FC = () => {
  return (
    <section className="bg-[#211334] py-7 text-white sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 max-w-2xl sm:mb-7">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-200">
            <ShieldCheck className="h-4 w-4" />
            Panduan Penggunaan
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Bangun Pengalaman Sosial yang Nyaman
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-purple-100/80">
            Kenali batasan layanan dan utamakan keselamatan saat berinteraksi, baik online maupun offline.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {GUIDELINES.map(({ Icon, title, description }, index) => (
            <article key={title} className="rounded-xl border border-white/15 bg-white/[0.06] p-4 sm:rounded-2xl sm:p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-purple-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white sm:text-base">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-purple-100/80">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
