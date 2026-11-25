import React from 'react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AppRoute } from '../types/navigation';
import { MapPin, Mail } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: AppRoute) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="relative overflow-hidden pt-8 pb-6 md:pt-16 md:pb-12 border-t border-purple-950" style={{ backgroundColor: "#260D3D", color: "#FFFFFF" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-6 md:gap-10 pb-7 md:pb-12 border-b border-purple-900/40">
          {/* Brand Col */}
          <div className="col-span-2 space-y-3 md:space-y-4 rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:p-6 shadow-[0_20px_55px_-35px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <BrandLogo size="md" showTagline={true} inverted={true} />
            <p className="text-sm text-slate-200 leading-relaxed max-w-sm mt-2 md:mt-3">
              YUKU adalah platform Social Experience & Paid Companionship Marketplace pertama di Indonesia yang menghubungkan individu untuk berbagi momen aktivitas sosial yang positif, aman, dan beradab.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-purple-300/15 bg-purple-300/[0.07] px-3 py-2 text-xs sm:text-sm text-purple-100">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Beroperasi di Seluruh Indonesia</span>
              </div>
              <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-purple-300/15 bg-purple-300/[0.07] px-3 py-2 text-xs sm:text-sm text-purple-100">
                <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>yukufriends@gmail.com</span>
              </div>
            </div>
          </div>

          {/* Quick Nav Col */}
          <div>
            <h4 className="text-[13px] sm:text-sm font-bold text-white uppercase tracking-wider mb-3 md:mb-4">
              Navigasi
            </h4>
            <ul className="space-y-2 sm:space-y-3 text-sm text-white">
              <li>
                <button
                  onClick={() => onNavigate('/')}
                  className="inline-flex min-h-11 items-center rounded-lg px-2 -ml-2 !text-white font-medium hover:bg-white/[0.06] hover:!text-amber-200 transition-all cursor-pointer"
                >
                  Beranda
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/talent')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Jelajahi Talent
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/komunitas')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Komunitas
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/cara-kerja')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Cara Kerja
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/daftar-talent')}
                  className="inline-flex min-h-11 items-center rounded-lg px-2 -ml-2 bg-amber-400/10 !text-amber-200 font-semibold hover:bg-amber-400/15 hover:!text-amber-100 transition-all cursor-pointer"
                >
                  Daftar Jadi Talent
                </button>
              </li>
            </ul>
          </div>

          {/* Company & Support Col */}
          <div>
            <h4 className="text-[13px] sm:text-sm font-bold text-white uppercase tracking-wider mb-3 md:mb-4">
              Informasi
            </h4>
            <ul className="space-y-2 sm:space-y-3 text-sm text-white">
              <li>
                <button
                  onClick={() => onNavigate('/tentang')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Tentang YUKU
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/faq')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  FAQ & Tanya Jawab
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/bantuan')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Pusat Bantuan
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/login')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Masuk Akun
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Col */}
          <div className="col-span-2 lg:col-span-1 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-0 md:border-0 md:bg-transparent">
            <h4 className="text-[13px] sm:text-sm font-bold text-white uppercase tracking-wider mb-3 md:mb-4">
              Ketentuan Hukum
            </h4>
            <ul className="space-y-2 sm:space-y-3 text-sm text-white">
              <li>
                <button
                  onClick={() => onNavigate('/syarat-ketentuan')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
                >
                  Syarat & Ketentuan
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/kebijakan-privasi')}
                  className="inline-flex min-h-11 items-center !text-white font-medium hover:!text-amber-200 transition-colors cursor-pointer"
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
        <div className="pt-5 md:pt-8 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 text-center md:text-left text-xs sm:text-sm text-white">
          <p className="max-w-2xl leading-relaxed">
            © {new Date().getFullYear()} YUKU (PT Inovasi Sosial Teman Indonesia). Seluruh hak cipta dilindungi undang-undang.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-purple-300/15 bg-purple-300/[0.06] px-3 py-2 text-xs sm:text-sm text-purple-50 backdrop-blur-lg">
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
