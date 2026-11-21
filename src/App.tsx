/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { MainLayout } from './layouts/MainLayout';
const HomePage = lazyPage(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })), 'Beranda');
const CommunityPage = lazyPage(() => import('./pages/CommunityPage').then((module) => ({ default: module.CommunityPage })), 'Komunitas');
const BrowseTalentPage = lazyPage(() => import('./pages/BrowseTalentPage').then((module) => ({ default: module.BrowseTalentPage })), 'Daftar Talent');
const TalentDetailPage = lazyPage(() => import('./pages/TalentDetailPage').then((module) => ({ default: module.TalentDetailPage })), 'Detail Talent');
const HowItWorksPage = lazyPage(() => import('./pages/HowItWorksPage').then((module) => ({ default: module.HowItWorksPage })), 'Cara Kerja');
const BecomeTalentPage = lazyPage(() => import('./pages/BecomeTalentPage').then((module) => ({ default: module.BecomeTalentPage })), 'Pendaftaran Talent');
const AboutPage = lazyPage(() => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })), 'Tentang YUKU');
const FaqPage = lazyPage(() => import('./pages/FaqPage').then((module) => ({ default: module.FaqPage })), 'FAQ');
const HelpCenterPage = lazyPage(() => import('./pages/HelpCenterPage').then((module) => ({ default: module.HelpCenterPage })), 'Pusat Bantuan');
const LoginPage = lazyPage(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })), 'Login');
const RegisterPage = lazyPage(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })), 'Registrasi');
const TermsPage = lazyPage(() => import('./pages/TermsPage').then((module) => ({ default: module.TermsPage })), 'Syarat dan Ketentuan');
const PrivacyPolicyPage = lazyPage(() => import('./pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })), 'Kebijakan Privasi');
const BookingHistoryPage = lazyPage(() => import('./pages/BookingHistoryPage').then((module) => ({ default: module.BookingHistoryPage })), 'Riwayat Booking');
const CustomerProfilePage = lazyPage(() => import('./pages/CustomerProfilePage').then((module) => ({ default: module.CustomerProfilePage })), 'Profil Saya');
const TalentDashboardPage = lazyPage(() => import('./pages/TalentDashboardPage').then((module) => ({ default: module.TalentDashboardPage })), 'Dashboard Talent');
const AdminPage = lazyPage(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })), 'Admin');
const VerifyKtpPage = lazyPage(() => import('./pages/VerifyKtpPage').then((module) => ({ default: module.VerifyKtpPage })), 'Verifikasi KTP');
const ChangePasswordPage = lazyPage(() => import('./pages/ChangePasswordPage').then((module) => ({ default: module.ChangePasswordPage })), 'Ganti Kata Sandi');
const ForgotPasswordPage = lazyPage(() => import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })), 'Lupa Kata Sandi');
const ResetPasswordPage = lazyPage(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })), 'Reset Kata Sandi');
const AdminInviteSetupPage = lazyPage(() => import('./pages/AdminInviteSetupPage').then((module) => ({ default: module.AdminInviteSetupPage })), 'Aktivasi Admin');
import { AppRoute } from './types/navigation';
import { supabase } from './lib/supabase';

const PAGE_LOAD_TIMEOUT_MS = 20_000;

function lazyPage<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  pageName: string,
) {
  return lazy(() => {
    let timeoutId: number;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error(`Halaman ${pageName} tidak selesai dimuat dalam 20 detik.`)),
        PAGE_LOAD_TIMEOUT_MS,
      );
    });
    return Promise.race([loader(), timeout]).finally(() => window.clearTimeout(timeoutId));
  });
}

class PageLoadErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('YUKU: halaman gagal dimuat', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-12 text-center" role="alert">
          <h2 className="text-lg font-bold text-slate-900">Halaman belum berhasil dibuka</h2>
          <p className="max-w-md text-sm text-slate-600">
            Koneksi mungkin terputus atau file halaman gagal dimuat. Silakan coba muat ulang halaman.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<AppRoute>(() => {
    const pathname = window.location.pathname;
    const inviteParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (pathname === '/aktivasi-admin' || inviteParams.get('type') === 'invite') return '/aktivasi-admin';
    if (pathname === '/talent') return '/talent';
    if (pathname === '/komunitas') return '/komunitas';
    if (pathname.startsWith('/talent/')) return '/talent/:id';
    if (pathname === '/cara-kerja') return '/cara-kerja';
    if (pathname === '/daftar-talent') return '/daftar-talent';
    if (pathname === '/dashboard-talent') return '/dashboard-talent';
    if (pathname === '/riwayat-booking') return '/riwayat-booking';
    if (pathname === '/profil-saya') return '/profil-saya';
    if (pathname === '/admin') return '/admin';
    if (pathname === '/tentang') return '/tentang';
    if (pathname === '/faq') return '/faq';
    if (pathname === '/bantuan') return '/bantuan';
    if (pathname === '/login') return '/login';
    if (pathname === '/register') return '/register';
    if (pathname === '/ganti-sandi') return '/ganti-sandi';
    if (pathname === '/lupa-sandi') return '/lupa-sandi';
    if (pathname === '/reset-sandi') return '/reset-sandi';
    if (pathname === '/verifikasi-ktp') return '/verifikasi-ktp';
    if (pathname === '/syarat-ketentuan') return '/syarat-ketentuan';
    if (pathname === '/kebijakan-privasi') return '/kebijakan-privasi';
    return '/';
  });
  const [activeTalentId, setActiveTalentId] = useState<string>('');
  const [initialActivityFilter, setInitialActivityFilter] = useState<string>('all');
  const [initialCityFilter, setInitialCityFilter] = useState<string>('Semua Kota');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  // Parse path and params from current location
  const parseCurrentLocation = useCallback(() => {
    const pathname = window.location.pathname;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);

    const act = searchParams.get('activity') || 'all';
    const city = searchParams.get('city') || 'Semua Kota';
    setInitialActivityFilter(act);
    setInitialCityFilter(city);

    if (pathname === '/aktivasi-admin' || hashParams.get('type') === 'invite') {
      setCurrentPath('/aktivasi-admin');
    } else if (pathname === '/' || pathname === '') {
      setCurrentPath('/');
    } else if (pathname === '/komunitas') {
      setCurrentPath('/komunitas');
    } else if (pathname === '/talent') {
      setCurrentPath('/talent');
    } else if (pathname.startsWith('/talent/')) {
      const id = pathname.replace('/talent/', '');
      setActiveTalentId(id || '');
      setCurrentPath('/talent/:id');
    } else if (pathname === '/cara-kerja') {
      setCurrentPath('/cara-kerja');
    } else if (pathname === '/daftar-talent') {
      setCurrentPath('/daftar-talent');
    } else if (pathname === '/dashboard-talent') {
      setCurrentPath('/dashboard-talent');
    } else if (pathname === '/riwayat-booking') {
      setCurrentPath('/riwayat-booking');
    } else if (pathname === '/profil-saya') {
      setCurrentPath('/profil-saya');
    } else if (pathname === '/admin') {
      setCurrentPath('/admin');
    } else if (pathname === '/tentang') {
      setCurrentPath('/tentang');
    } else if (pathname === '/faq') {
      setCurrentPath('/faq');
    } else if (pathname === '/bantuan') {
      setCurrentPath('/bantuan');
    } else if (pathname === '/login') {
      setCurrentPath('/login');
    } else if (pathname === '/register') {
      setCurrentPath('/register');
    } else if (pathname === '/ganti-sandi') {
      setCurrentPath('/ganti-sandi');
    } else if (pathname === '/lupa-sandi') {
      setCurrentPath('/lupa-sandi');
    } else if (pathname === '/reset-sandi') {
      setCurrentPath('/reset-sandi');
    } else if (pathname === '/verifikasi-ktp') {
      setCurrentPath('/verifikasi-ktp');
    } else if (pathname === '/syarat-ketentuan') {
      setCurrentPath('/syarat-ketentuan');
    } else if (pathname === '/kebijakan-privasi') {
      setCurrentPath('/kebijakan-privasi');
    } else {
      setCurrentPath('/');
    }
  }, []);

  useEffect(() => {
    parseCurrentLocation();

    const handlePopState = () => {
      parseCurrentLocation();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }
    });

    window.addEventListener('popstate', handlePopState);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [parseCurrentLocation]);

  // Navigate handler with browser history synchronization
  const handleNavigate = (path: AppRoute, params?: Record<string, string>) => {
    let targetUrl = path as string;

    if (path === '/talent/:id') {
      const id = params?.id || activeTalentId;
      setActiveTalentId(id);
      targetUrl = `/talent/${id}`;
    } else if (path === '/talent') {
      if (params?.activity) setInitialActivityFilter(params.activity);
      if (params?.city) setInitialCityFilter(params.city);

      const qs = new URLSearchParams();
      if (params?.activity && params.activity !== 'all') qs.set('activity', params.activity);
      if (params?.city && params.city !== 'Semua Kota') qs.set('city', params.city);
      const queryString = qs.toString();
      targetUrl = queryString ? `/talent?${queryString}` : '/talent';
    }

    try {
      window.history.pushState(null, '', targetUrl);
    } catch {
      // Fallback if environment restricts history state
    }

    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render appropriate page view
  const renderCurrentPage = () => {
    switch (currentPath) {
      case '/':
        return <HomePage onNavigate={handleNavigate} />;
      case '/komunitas':
        return <CommunityPage onNavigate={handleNavigate} />;
      case '/talent':
        return (
          <BrowseTalentPage
            initialActivity={initialActivityFilter}
            initialCity={initialCityFilter}
            onNavigate={handleNavigate}
          />
        );
      case '/talent/:id':
        return (
          <TalentDetailPage
            talentId={activeTalentId}
            onNavigate={handleNavigate}
          />
        );
      case '/cara-kerja':
        return <HowItWorksPage onNavigate={handleNavigate} />;
      case '/daftar-talent':
        return <BecomeTalentPage onNavigate={handleNavigate} />;
      case '/dashboard-talent':
        return <TalentDashboardPage onNavigate={handleNavigate} />;
      case '/riwayat-booking':
        return <BookingHistoryPage onNavigate={handleNavigate} />;
      case '/profil-saya':
        return <CustomerProfilePage onNavigate={handleNavigate} />;
      case '/admin':
        return <AdminPage onNavigate={handleNavigate} />;
      case '/tentang':
        return <AboutPage onNavigate={handleNavigate} />;
      case '/faq':
        return <FaqPage onNavigate={handleNavigate} />;
      case '/bantuan':
        return <HelpCenterPage onNavigate={handleNavigate} />;
      case '/login':
        return <LoginPage onNavigate={handleNavigate} />;
      case '/register':
        return <RegisterPage onNavigate={handleNavigate} />;
      case '/ganti-sandi':
        return <ChangePasswordPage onNavigate={handleNavigate} />;
      case '/lupa-sandi':
        return <ForgotPasswordPage onNavigate={handleNavigate} />;
      case '/aktivasi-admin':
        return <AdminInviteSetupPage onNavigate={handleNavigate} />;
      case '/reset-sandi':
        return (
          <ResetPasswordPage
            onNavigate={handleNavigate}
            initialRecoveryActive={isPasswordRecovery}
          />
        );
      case '/verifikasi-ktp':
        return <VerifyKtpPage onNavigate={handleNavigate} />;
      case '/syarat-ketentuan':
        return <TermsPage />;
      case '/kebijakan-privasi':
        return <PrivacyPolicyPage />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <MainLayout currentPath={currentPath} onNavigate={handleNavigate}>
      <PageLoadErrorBoundary key={currentPath}>
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center px-4 py-12" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-semibold text-purple-800 shadow-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-200 border-t-purple-700" aria-hidden="true" />
              Memuat halaman...
            </div>
          </div>
        }
      >
        {renderCurrentPage()}
      </Suspense>
      </PageLoadErrorBoundary>
    </MainLayout>
  );
}
