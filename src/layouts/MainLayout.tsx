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

const PRIVATE_WORKSPACE_ROUTES: string[] = [
  '/admin',
  '/dashboard-talent',
  '/riwayat-booking',
  '/profil-saya',
  '/verifikasi-ktp',
];

const HIDE_BOTTOM_NAV: string[] = [
  '/talent/:id',
  '/login',
  '/register',
  '/lupa-sandi',
  '/reset-sandi',
  '/ganti-sandi',
];

/**
 * Layout utama. TIDAK memeriksa auth sendiri:
 * status login/role diambil oleh <Navbar> dan <MobileBottomNav> dari useAuth() (AuthContext).
 * <Navbar> adalah satu-satunya <header> di seluruh aplikasi.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const showBottomNav = !HIDE_BOTTOM_NAV.includes(currentPath);
  const isPrivateWorkspace = PRIVATE_WORKSPACE_ROUTES.includes(currentPath);

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#FAF8FC] text-slate-800 ${
        showBottomNav ? 'pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0' : ''
      }`}
    >
      {/* Satu-satunya <header> aplikasi */}
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="flex-1">{children}</main>

      {!isPrivateWorkspace && currentPath !== '/' && <SafetyPledgeBanner />}

      {!isPrivateWorkspace && <Footer onNavigate={onNavigate} />}

      {showBottomNav && <MobileBottomNav currentPath={currentPath} onNavigate={onNavigate} />}
    </div>
  );
};
