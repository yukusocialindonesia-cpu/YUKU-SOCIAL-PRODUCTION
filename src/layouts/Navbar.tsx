import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, User, Sparkles, LogOut, ShoppingBag, ShieldCheck, KeyRound, ChevronDown, Bell } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { NotificationBell } from '../components/common/NotificationBell';
import { AppRoute } from '../types/navigation';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: AppRoute) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const isHomePage = currentPath === '/';
  const { user: currentUser, role: userRole, isAuthLoading, signOut } = useAuth();

  useEffect(() => {
    const openMenu = () => setIsMobileMenuOpen(true);
    window.addEventListener('yuku:open-menu', openMenu);
    return () => window.removeEventListener('yuku:open-menu', openMenu);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks: { label: string; href: AppRoute }[] = [
    { label: 'Beranda', href: '/' },
    { label: 'Jelajahi Talent', href: '/talent' },
    { label: 'Komunitas', href: '/komunitas' },
    { label: 'Cara Kerja', href: '/cara-kerja' },
    { label: 'Tentang Kami', href: '/tentang' },
    { label: 'FAQ', href: '/faq' },
  ];

  const handleLinkClick = (href: AppRoute) => {
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen(false);
    onNavigate(href);
  };

  const handleLogout = async () => {
    await signOut();
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
    onNavigate('/');
  };

  const displayName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split('@')[0] ||
    'Pengguna';

  // Selama sesi + role belum pulih: hanya logo, tanpa menu / tombol Masuk / Daftar.
  // Tetap SATU <header> dengan tinggi yang sama agar layout tidak bergeser.
  if (isAuthLoading) {
    return (
      <header
        className={`fixed inset-x-0 top-0 xl:sticky xl:inset-x-auto xl:top-3 z-40 w-full xl:w-[calc(100%-2rem)] yuku-glass-shell ${isHomePage ? 'bg-white/95 border-b border-[#EEEAF5] shadow-[0_8px_28px_-18px_rgba(36,16,95,0.12)] xl:bg-white/95 xl:border-[#EEEAF5] xl:shadow-[0_16px_42px_-20px_rgba(36,16,95,0.12)]' : 'bg-[#FCFAFF] border-b border-violet-100 shadow-[0_8px_28px_-18px_rgba(55,18,112,0.24)] xl:bg-white/90 xl:border-violet-100 xl:shadow-[0_16px_42px_-20px_rgba(55,18,112,0.24)]'} backdrop-blur-xl xl:backdrop-blur-2xl xl:border xl:border-violet-100/90 xl:rounded-2xl xl:w-[calc(100%-2rem)] xl:max-w-7xl xl:mx-auto`}
        aria-busy="true"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-8 h-14 min-[376px]:h-14 min-[431px]:h-[60px] lg:h-16 min-[1440px]:h-[76px]">
            <div className="shrink-0 flex items-center">
              <BrandLogo size="md" showTagline={false} inverted={false} className="[&>img]:h-9 min-[431px]:[&>img]:h-10 lg:[&>img]:h-11 xl:[&>img]:h-12" onClick={() => onNavigate('/')} />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={`fixed inset-x-0 top-0 xl:sticky xl:inset-x-auto xl:top-3 z-40 w-full xl:w-[calc(100%-2rem)] yuku-glass-shell ${isHomePage ? 'bg-white/95 border-b border-[#EEEAF5] shadow-[0_8px_28px_-18px_rgba(36,16,95,0.12)] xl:bg-white/95 xl:border-[#EEEAF5] xl:shadow-[0_12px_36px_rgba(36,16,95,0.12)]' : 'bg-[#FCFAFF] border-b border-violet-100 shadow-[0_8px_28px_-18px_rgba(55,18,112,0.20)] xl:bg-white/92 xl:border-violet-100 xl:shadow-[0_12px_36px_rgba(55,18,112,0.12)]'} backdrop-blur-xl xl:backdrop-blur-xl xl:border xl:border-violet-100/90 xl:rounded-2xl xl:w-[calc(100%-2rem)] xl:max-w-7xl xl:mx-auto`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar 3-Zone Contract: Brand — Links — 1 Primary Action */}
        <div className="flex items-center justify-between gap-8 h-14 min-[376px]:h-14 min-[431px]:h-[60px] lg:h-16 min-[1440px]:h-[76px]">
          {/* Zone 1: Single Brand Element */}
          <div className="shrink-0 flex items-center">
            <BrandLogo
              size="md"
              showTagline={false}
              inverted={false}
              className="[&>img]:h-9 min-[431px]:[&>img]:h-10 lg:[&>img]:h-11 xl:[&>img]:h-12"
              onClick={() => handleLinkClick('/')}
            />
          </div>

          {/* Zone 2: 4-5 Concise Single-line Nav Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-7 text-sm font-semibold text-slate-600">
            {navLinks.map((link) => {
              const isActive =
                currentPath === link.href ||
                (link.href !== '/' && currentPath.startsWith(link.href));
              return (
                <button
                  key={link.href}
                  onClick={() => handleLinkClick(link.href)}
                  className={`whitespace-nowrap transition-colors relative py-1 cursor-pointer ${
                    isActive
                      ? 'text-purple-900 font-bold'
                      : 'hover:text-purple-700 text-slate-600'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#24105F] to-[#741CFF] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Shared notification + responsive account actions */}
          <div className="flex items-center gap-2 xl:gap-3 shrink-0">
            {currentUser ? (
              <NotificationBell
                userId={currentUser.id}
                userRole={userRole}
                onNavigate={handleLinkClick}
              />
            ) : (
              <button
                type="button"
                onClick={() => handleLinkClick('/login')}
                aria-label="Masuk untuk melihat notifikasi"
                title="Masuk untuk melihat notifikasi"
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm transition ${'border-purple-100/80 bg-white/85 text-slate-700 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-900'}`}
              >
                <Bell className="h-4 w-4" />
              </button>
            )}
            <div className="hidden xl:flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2.5">
                {userRole === 'admin' && (
                  <button
                    onClick={() => handleLinkClick('/admin')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      currentPath === '/admin'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                        : 'bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100'
                    }`}
                    title="Buka Panel Admin & Kurasi YUKU"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>Admin Panel</span>
                  </button>
                )}

                {userRole === 'talent' && (
                  <button
                    onClick={() => handleLinkClick('/dashboard-talent')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      currentPath === '/dashboard-talent'
                        ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                        : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                    }`}
                    title="Buka Dashboard Talent"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Dashboard Talent</span>
                  </button>
                )}

                {userRole === 'customer' && (
                  <>
                    <button
                      onClick={() => handleLinkClick('/riwayat-booking')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        currentPath === '/riwayat-booking'
                          ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                      title="Lihat riwayat booking dan status pesanan customer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pesanan Saya</span>
                    </button>

                    <button
                      onClick={() => handleLinkClick('/verifikasi-ktp')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        currentPath === '/verifikasi-ktp'
                          ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                      title="Ajukan atau periksa status verifikasi e-KTP customer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verifikasi KTP</span>
                    </button>
                  </>
                )}

                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 rounded-xl transition-colors cursor-pointer"
                    aria-expanded={isAccountMenuOpen}
                    aria-haspopup="menu"
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-700 text-white flex items-center justify-center text-xs font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-purple-900 max-w-[120px] truncate">
                      {displayName}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-purple-700 transition-transform ${
                        isAccountMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isAccountMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-3 w-56 bg-white/90 backdrop-blur-2xl rounded-2xl border border-white shadow-[0_22px_55px_-22px_rgba(76,29,149,0.35)] ring-1 ring-purple-100/70 py-2 z-50"
                    >
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-900 truncate">{displayName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                      </div>

                      <div className="py-1">
                        {userRole === 'customer' && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleLinkClick('/profil-saya')}
                            className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                              currentPath === '/profil-saya' ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <User className="w-3.5 h-3.5 text-purple-700" />
                            <span>Profil Saya</span>
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleLinkClick('/ganti-sandi')}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                            currentPath === '/ganti-sandi'
                              ? 'bg-purple-50 text-purple-900 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5 text-purple-700" />
                          <span>Ganti Kata Sandi</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleLinkClick('/login')}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-purple-900 transition-colors cursor-pointer"
                >
                  Masuk
                </button>

                <button
                  onClick={() => handleLinkClick('/register')}
                  className="min-h-11 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#24105F] to-[#741CFF] hover:from-[#1B0B49] hover:to-[#5F13D6] rounded-lg shadow-xs hover:shadow transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Daftar Sekarang</span>
                </button>
              </>
            )}
            </div>

            {/* Mobile Menu Button */}
            <div className="xl:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className={`min-h-11 min-w-11 p-1.5 sm:p-2.5 inline-flex items-center justify-center rounded-xl border shadow-sm transition-all ${isHomePage ? 'border-white/15 bg-white/10 text-white hover:bg-white/20' : 'border-purple-100/80 bg-white/75 text-slate-600 hover:bg-purple-50 hover:text-purple-800'}`}
              aria-label={isMobileMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="yuku-mobile-navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div
          id="yuku-mobile-navigation"
          className={`xl:hidden border-t px-4 pt-4 pb-6 backdrop-blur-2xl max-h-[calc(100dvh-3.5rem-4rem-env(safe-area-inset-bottom))] min-[376px]:max-h-[calc(100dvh-3.75rem-4rem-env(safe-area-inset-bottom))] min-[431px]:max-h-[calc(100dvh-4rem-4rem-env(safe-area-inset-bottom))] md:max-h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4.5rem)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 ${isHomePage ? "border-white/10 bg-[#1b073b]/[0.98] shadow-[0_24px_50px_-28px_rgba(12,3,28,0.8)]" : "border-purple-100/70 bg-white shadow-[0_24px_50px_-28px_rgba(76,29,149,0.35)]"}` }
        >
          {currentUser && (
            <div className={`mb-4 p-3.5 rounded-2xl flex items-center justify-between border ${isHomePage ? "bg-white/[0.07] border-white/10" : "bg-gradient-to-br from-purple-50/95 to-fuchsia-50/80 border-purple-100/80"} shadow-[0_10px_25px_-18px_rgba(109,40,217,0.35)]`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center text-xs font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className={`text-xs font-bold ${isHomePage ? "text-white" : "text-purple-950"}`}>{displayName}</div>
                  <div className={`text-[11px] truncate max-w-[180px] ${isHomePage ? "text-white/55" : "text-slate-500"}`}>
                    {currentUser.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-1 mb-4">
            {currentUser && (
              <>
                {userRole === 'admin' && (
                  <button
                    onClick={() => handleLinkClick('/admin')}
                    className={`text-left px-3 py-3 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                      currentPath === '/admin'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-amber-50 text-amber-950 hover:bg-amber-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Admin Panel</span>
                  </button>
                )}

                {userRole === 'talent' && (
                  <button
                    onClick={() => handleLinkClick('/dashboard-talent')}
                    className={`text-left px-3 py-3 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                      currentPath === '/dashboard-talent'
                        ? 'bg-purple-700 text-white'
                        : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Dashboard Talent</span>
                  </button>
                )}

                {userRole === 'customer' && (
                  <>
                    <button
                      onClick={() => handleLinkClick('/profil-saya')}
                      className={`text-left px-3 py-3 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                        currentPath === '/profil-saya' ? 'bg-purple-100 text-purple-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <User className="w-4 h-4 text-purple-700" />
                      <span>Profil Saya</span>
                    </button>
                    <button
                      onClick={() => handleLinkClick('/riwayat-booking')}
                      className={`text-left px-3 py-3 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                        currentPath === '/riwayat-booking'
                          ? 'bg-purple-100 text-purple-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 text-purple-700" />
                      <span>Riwayat Booking (Customer)</span>
                    </button>

                    <button
                      onClick={() => handleLinkClick('/verifikasi-ktp')}
                      className={`text-left px-3 py-3 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                        currentPath === '/verifikasi-ktp'
                          ? 'bg-purple-100 text-purple-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Verifikasi e-KTP Customer</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleLinkClick('/ganti-sandi')}
                  className={`text-left px-3 py-3 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                    currentPath === '/ganti-sandi'
                      ? 'bg-purple-100 text-purple-900'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-purple-700" />
                  <span>Ganti Kata Sandi</span>
                </button>
              </>
            )}

            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleLinkClick(link.href)}
                className={`text-left px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${
                  currentPath === link.href || (link.href !== '/' && currentPath.startsWith(link.href))
                    ? (isHomePage ? 'bg-white/12 text-white font-bold' : 'bg-purple-50 text-purple-900 font-bold')
                    : (isHomePage ? 'text-white/75 hover:bg-white/[0.07] hover:text-white' : 'text-slate-700 hover:bg-slate-50')
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => handleLinkClick('/bantuan')}
              className={`text-left px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${isHomePage ? 'text-white/75 hover:bg-white/[0.07] hover:text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              Pusat Bantuan
            </button>
          </div>

          <div className={`pt-3 border-t flex flex-col gap-2 ${isHomePage ? 'border-white/10' : 'border-slate-100'}`}>
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="w-full py-3 text-center text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Akun</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleLinkClick('/login')}
                  className={`w-full py-3 text-center text-sm font-bold rounded-lg transition-colors ${isHomePage ? 'text-white bg-white/10 hover:bg-white/15 border border-white/10' : 'text-slate-800 bg-slate-100 hover:bg-slate-200'}`}
                >
                  Masuk ke Akun
                </button>
                <button
                  onClick={() => handleLinkClick('/register')}
                  className="w-full py-3 text-center text-sm font-bold text-white bg-gradient-to-r from-[#7427db] via-[#741cff] to-[#ed1688] rounded-xl shadow-[0_8px_20px_rgba(116,28,255,0.22)]"
                >
                  Daftar Akun Customer
                </button>
                <button
                  onClick={() => handleLinkClick('/daftar-talent')}
                  className={`w-full py-2 text-center text-xs font-semibold transition-colors ${isHomePage ? 'text-[#d7b8ff] hover:text-white' : 'text-purple-700 hover:text-purple-900'}`}
                >
                  Ingin bergabung jadi Talent?
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
