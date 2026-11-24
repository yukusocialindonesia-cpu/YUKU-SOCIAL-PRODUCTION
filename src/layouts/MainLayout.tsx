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

  return (
    <div
      className={`min-h-screen flex flex-col bg-transparent text-slate-800 ${
        showBottomNav ? 'pb-[calc(104px+env(safe-area-inset-bottom))] md:pb-0' : ''
      }`}
    >
      {/* Satu-satunya header aplikasi; sticky dan konsisten di semua halaman. */}
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="flex-1">{children}</main>

      {currentPath !== '/' && <SafetyPledgeBanner />}

      <Footer onNavigate={onNavigate} />

      {showBottomNav && <MobileBottomNav currentPath={currentPath} onNavigate={onNavigate} />}
    </div>
  );
};
