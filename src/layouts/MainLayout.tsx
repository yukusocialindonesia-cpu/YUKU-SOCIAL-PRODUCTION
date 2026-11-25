import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';
import { SafetyPledgeBanner } from '../components/common/SafetyPledgeBanner';
import { AppRoute } from '../types/navigation';

interface MainLayoutProps {
  currentPath: string;
  onNavigate: (path: AppRoute) => void;
  children: React.ReactNode;
}

const HIDE_BOTTOM_NAV: string[] = [
  '/talent/:id',
  '/login',
  '/register',
  '/lupa-sandi',
  '/reset-sandi',
  '/ganti-sandi',
  '/aktivasi-admin',
];

/**
 * Layout utama. TIDAK memeriksa auth sendiri:
 * status login/role diambil oleh <Navbar> dan <MobileBottomNav> dari useAuth() (AuthContext).
 * <Navbar> adalah satu-satunya <header> di seluruh aplikasi.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const showBottomNav = !HIDE_BOTTOM_NAV.includes(currentPath);
  const isAppWorkspace = ['/', '/talent', '/komunitas', '/dashboard-talent', '/riwayat-booking', '/profil-saya'].some((path) => currentPath === path || (path !== '/' && currentPath.startsWith(path))) || /^\/talent\/[^/]+$/.test(currentPath);

  return (
    <div
      className={`min-h-screen flex flex-col bg-transparent text-slate-800 ${
        showBottomNav ? 'pb-[calc(104px+env(safe-area-inset-bottom))] md:pb-0' : ''
      }`}
    >
      {/* Header fixed di HP; spacer menjaga konten tidak tertutup. Desktop tetap sticky. */}
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />
      <div aria-hidden="true" className="h-14 min-[376px]:h-14 min-[431px]:h-[60px] lg:h-16 xl:hidden" />

      <main className={`yuku-route-stage relative isolate flex-1 route-${currentPath.replaceAll("/", "-").replaceAll(":", "") || "home"}`}>{children}</main>

      {currentPath !== '/' && <div className={isAppWorkspace ? 'hidden md:block' : ''}><SafetyPledgeBanner /></div>}

      <div className={isAppWorkspace ? 'hidden md:block' : ''}>
        <Footer onNavigate={onNavigate} />
      </div>

      {showBottomNav && <MobileBottomNav currentPath={currentPath} onNavigate={onNavigate} />}
    </div>
  );
};
