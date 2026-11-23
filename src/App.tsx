/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { CommunityPage } from './pages/CommunityPage';
import { BrowseTalentPage } from './pages/BrowseTalentPage';
import { TalentDetailPage } from './pages/TalentDetailPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { BecomeTalentPage } from './pages/BecomeTalentPage';
import { AboutPage } from './pages/AboutPage';
import { FaqPage } from './pages/FaqPage';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { BookingHistoryPage } from './pages/BookingHistoryPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { TalentDashboardPage } from './pages/TalentDashboardPage';
import { AdminPage } from './pages/AdminPage';
import { VerifyKtpPage } from './pages/VerifyKtpPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminInviteSetupPage } from './pages/AdminInviteSetupPage';
import { AppRoute } from './types/navigation';
import { supabase } from './lib/supabase';
import { isDemoMode } from './utils/demoMode';

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
  const [initialModeFilter, setInitialModeFilter] = useState<string>('all');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  // Parse path and params from current location
  const parseCurrentLocation = useCallback(() => {
    const pathname = window.location.pathname;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);

    const act = searchParams.get('activity') || 'all';
    const city = searchParams.get('city') || 'Semua Kota';
    const mode = searchParams.get('mode') || 'all';
    setInitialActivityFilter(act);
    setInitialCityFilter(city);
    setInitialModeFilter(mode === 'online' || mode === 'offline' ? mode : 'all');

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

    if (isDemoMode) {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }

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
      setInitialModeFilter(params?.mode === 'online' || params?.mode === 'offline' ? params.mode : 'all');

      const qs = new URLSearchParams();
      if (params?.activity && params.activity !== 'all') qs.set('activity', params.activity);
      if (params?.city && params.city !== 'Semua Kota') qs.set('city', params.city);
      if (params?.mode === 'online' || params?.mode === 'offline') qs.set('mode', params.mode);
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
            initialMode={initialModeFilter}
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
      {renderCurrentPage()}
    </MainLayout>
  );
}
