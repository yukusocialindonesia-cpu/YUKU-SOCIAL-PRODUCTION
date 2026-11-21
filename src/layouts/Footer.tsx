import React from 'react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AppRoute } from '../types/navigation';
import { ShieldCheck, Heart, MapPin, Mail } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: AppRoute) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(109,40,217,0.18),transparent_55%),#140624] text-slate-200 pt-10 pb-8 md:pt-16 md:pb-12 border-t border-purple-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-8 md:gap-10 pb-8 md:pb-12 border-b border-purple-900/40">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6 shadow-[0_20px_55px_-35px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <BrandLogo size="md" showTagline={true} inverted={true} />
            <p className="text-sm text-slate-200 leading-relaxed max-w-sm mt-3">
              YUKU adalah platform Social Experience & Paid Companionship Marketplace pertama di Indonesia yang menghubungkan individu untuk berbagi momen aktivitas sosial yang positif, aman, dan beradab.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/15 bg-purple-300/[0.07] px-3 py-2 text-sm text-purple-100">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Beroperasi di Seluruh Indonesia</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/15 bg-purple-300/[0.07] px-3 py-2 text-xs text-purple-200/90">
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>yukufriends@gmail.com</span>
            </div>
          </div>

          {/* Quick Nav Col */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Navigasi
            </h4>
            <ul className="space-y-3 text-sm text-slate-200">
              <li>
                <button
                  onClick={() => onNavigate('/')}
                  className="inline-flex min-h-8 items-center rounded-lg px-2 -ml-2 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
                >
                  Beranda
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/talent')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Jelajahi Talent
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/cara-kerja')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Cara Kerja
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/daftar-talent')}
                  className="inline-flex min-h-8 items-center rounded-lg px-2 -ml-2 bg-amber-400/10 text-amber-300 font-semibold hover:bg-amber-400/15 hover:text-amber-200 transition-all cursor-pointer"
                >
                  Daftar Jadi Talent
                </button>
              </li>
            </ul>
          </div>

          {/* Company & Support Col */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Informasi
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('/tentang')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Tentang YUKU
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/faq')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  FAQ & Tanya Jawab
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/bantuan')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Pusat Bantuan
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/login')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Masuk Akun
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Col */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Ketentuan Hukum
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('/syarat-ketentuan')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Syarat & Ketentuan
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/kebijakan-privasi')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Kebijakan Privasi
                </button>
              </li>
              <li className="pt-2 text-xs text-purple-100 leading-relaxed">
                Strict 18+ Verification Policy. Non-sexual & Non-dating companionship platform.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Mandatory Legal Disclaimers */}
        <div className="pt-6 md:pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm sm:text-base text-white">
          <p>
            © {new Date().getFullYear()} YUKU (PT Inovasi Sosial Teman Indonesia). Seluruh hak cipta dilindungi undang-undang.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-purple-300/15 bg-purple-300/[0.06] px-3 py-2 text-purple-50 backdrop-blur-lg">
            <span>Usia Minimum 18 Tahun</span>
            <span>·</span>
            <span>Bukan Aplikasi Kencan</span>
            <span>·</span>
            <span className="text-purple-50">Ruang Publik & Aman</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
