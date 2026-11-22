import React from 'react';
import { ArrowRight, MapPin, Clock, MessageCircle } from 'lucide-react';

interface TalentCtaSectionProps {
  onExploreClick: () => void;
  onRegisterCustomerClick: () => void;
  onRegisterClick: () => void;
}

export const TalentCtaSection: React.FC<TalentCtaSectionProps> = ({
  onExploreClick,
  onRegisterCustomerClick,
  onRegisterClick,
}) => {
  return (
    <section className="bg-[#211334] py-8 text-white sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">
              Mulai dari sini
            </span>
            <h2 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight sm:text-4xl">
              Temukan teman untuk aktivitas yang kamu suka
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-purple-100/80 sm:text-base">
              Pilih teman online atau offline, jelajahi aktivitas, lalu lihat informasi dan tarif layanan di profil Talent sebelum mengajukan jadwal.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-200" />
                <span className="text-sm leading-relaxed text-purple-100/90">Pilihan aktivitas online dan offline</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-purple-200" />
                <span className="text-sm leading-relaxed text-purple-100/90">Informasi jadwal dan tarif di profil</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-200" />
                <span className="text-sm leading-relaxed text-purple-100/90">Ruang untuk terhubung dan berinteraksi</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onExploreClick}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#211334]"
              >
                Jelajahi Talent
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRegisterCustomerClick}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Daftar sebagai Customer
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 sm:p-5 lg:col-span-4">
            <p className="text-sm font-semibold text-white">Ingin bergabung sebagai Talent?</p>
            <p className="mt-1 text-sm leading-relaxed text-purple-100/80">
              Bagikan minat dan aktivitas yang ingin kamu temani melalui profil YUKU.
            </p>
            <button
              type="button"
              onClick={onRegisterClick}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#32164B] transition-colors hover:bg-purple-50"
            >
              Daftar Talent
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
