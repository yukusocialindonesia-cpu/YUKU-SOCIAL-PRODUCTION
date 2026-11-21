import React from 'react';
import { ShieldCheck, HeartHandshake, Ban, Users } from 'lucide-react';

export const SafetyPledgeBanner: React.FC = () => {
  return (
    <div className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_left,_rgba(168,85,247,0.22),_transparent_48%),linear-gradient(110deg,#1E0938_0%,#2E1250_55%,#24103D_100%)] text-white py-5 px-4 border-y border-purple-900/40 shadow-[0_16px_40px_-28px_rgba(30,9,56,0.7)]">
      <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/10 ring-1 ring-white/15 shadow-inner shadow-white/10 flex items-center justify-center text-purple-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white tracking-wide text-sm">
              Komitmen Integritas & Keselamatan YUKU
            </h4>
            <p className="text-purple-200/80 text-xs">
              Social Experience & Paid Companionship Marketplace pertama yang aman dan beradab di Indonesia.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-slate-300">
          <div className="flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span className="font-medium text-slate-200">Bukan Aplikasi Kencan</span>
          </div>
          <span className="text-purple-600 hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span className="font-medium text-slate-200">Bukan Layanan Seksual</span>
          </div>
          <span className="text-purple-600 hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-medium text-slate-200">Wajib 18+ Tahun</span>
          </div>
          <span className="text-purple-600 hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium text-slate-200">Ruang Publik & Aman</span>
          </div>
        </div>
      </div>
    </div>
  );
};
