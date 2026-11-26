import React from 'react';
import { ArrowUpRight, Building2, MapPin, MessageCircle, Store, UsersRound } from 'lucide-react';

interface EcosystemSectionProps {
  onCommunityClick: () => void;
  onMerchantClick: () => void;
}

export const EcosystemSection: React.FC<EcosystemSectionProps> = ({ onCommunityClick, onMerchantClick }) => (
  <section className="relative overflow-hidden bg-[#160B2B] py-7 text-white sm:py-10">
    <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-5 max-w-xl">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-fuchsia-300">Lebih dari sekadar layanan</span>
        <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Terhubung dengan ekosistem YUKU</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-violet-100/75 sm:text-sm">Temukan komunitas, aktivitas, dan bisnis lokal dalam satu pengalaman.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="group flex min-h-[158px] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-400/15 text-fuchsia-200"><UsersRound className="h-5 w-5" /></span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Sudah tersedia</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold">Community</h3>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-violet-100/75 sm:text-xs">Berbagi cerita, minat, dan aktivitas bersama pengguna YUKU.</p>
            </div>
            <button type="button" onClick={onCommunityClick} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-violet-950 transition group-hover:bg-fuchsia-200" aria-label="Buka Community"><ArrowUpRight className="h-4 w-4" /></button>
          </div>
        </article>

        <article className="flex min-h-[158px] flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-300/15 text-violet-100"><Store className="h-5 w-5" /></span>
            <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-100">Partner ecosystem</span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-extrabold">Merchant Partner</h3>
            <p className="mt-1 max-w-md text-[11px] leading-relaxed text-violet-100/80 sm:text-xs">Ruang bagi bisnis, tempat aktivitas, dan merchant lokal untuk memperkenalkan usaha serta penawaran mereka kepada komunitas YUKU.</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-violet-100/75">
              <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> Profil bisnis</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Lokasi</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Promo & penawaran</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[10px] font-semibold text-fuchsia-200">Bisnis terverifikasi tampil di sini</p><button type="button" onClick={onMerchantClick} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[10px] font-extrabold text-violet-950 transition hover:bg-fuchsia-100">Jelajahi <ArrowUpRight className="h-3 w-3" /></button></div>
          </div>
        </article>
      </div>
    </div>
  </section>
);
