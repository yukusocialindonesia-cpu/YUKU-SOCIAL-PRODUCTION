import React from 'react';
import { ArrowRight, MessageCircle, UsersRound } from 'lucide-react';

interface CommunityPreviewSectionProps {
  onOpenCommunity: () => void;
}

/** A compact entry point to the existing Community page; no new data or database behavior. */
export const CommunityPreviewSection: React.FC<CommunityPreviewSectionProps> = ({ onOpenCommunity }) => {
  return (
    <section className="bg-white py-5 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[#FBFAFD] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <UsersRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Ruang interaksi YUKU</p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Terhubung lewat Komunitas</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                Berbagi cerita, ikut diskusi, dan temukan orang dengan minat yang sama.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenCommunity}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-4 w-4" />
            Buka Komunitas
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
