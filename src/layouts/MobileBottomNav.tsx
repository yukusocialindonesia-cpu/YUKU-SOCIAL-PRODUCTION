import React from 'react';
import { Home, Search, Bookmark, User, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';

interface MobileBottomNavProps {
  currentPath: string;
  onNavigate: (path: AppRoute) => void;
}

type NavEntry = {
  label: string;
  route: AppRoute | null;
  icon: React.ReactNode;
  onPress: () => void;
};

/**
 * Navigasi floating khusus HP.
 * Tujuan menu mengikuti capability snapshot, dengan fallback ke role lama.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath, onNavigate }) => {
  const { user, role, accessSnapshot, isAuthLoading } = useAuth();
  const loggedIn = Boolean(user);
  const icon = 'w-5 h-5 sm:w-[21px] sm:h-[21px]';
  const customerAvailable = accessSnapshot?.capabilities.customer.available ?? (role === 'customer' || role === 'talent');
  const talentWorkspaceAvailable = accessSnapshot
    ? accessSnapshot.capabilities.talent?.status === 'approved'
    : role === 'talent';
  const ordersRoute: AppRoute | null =
    role === 'admin' ? '/admin' : customerAvailable ? '/riwayat-booking' : talentWorkspaceAvailable ? '/dashboard-talent' : null;

  const openProfile = () => {
    if (!loggedIn) {
      onNavigate('/login');
      return;
    }
    if (role === 'admin') {
      onNavigate('/admin');
    } else if (customerAvailable) {
      // Akses Customer tetap tersedia pada akun multi-profil, termasuk Talent.
      onNavigate('/profil-saya');
    } else if (talentWorkspaceAvailable) {
      onNavigate('/dashboard-talent');
    } else if (accessSnapshot?.capabilities.professionalProvider) {
      onNavigate('/daftar-jasa-profesional');
    } else if (accessSnapshot?.capabilities.merchantMemberships.some((membership) => membership.status === 'active')) {
      onNavigate('/merchant-center');
    } else {
      // Sesi aktif tetapi belum memiliki workspace yang dapat dibuka.
      window.dispatchEvent(new CustomEvent('yuku:open-menu'));
    }
  };

  const items: NavEntry[] = [
    { label: 'Beranda', route: '/', icon: <Home className={icon} strokeWidth={2.1} />, onPress: () => onNavigate('/') },
    { label: 'Jelajah', route: '/talent', icon: <Search className={icon} strokeWidth={2.1} />, onPress: () => onNavigate('/talent') },
    { label: 'Komunitas', route: '/komunitas', icon: <Users className={icon} strokeWidth={2.1} />, onPress: () => onNavigate('/komunitas') },
    {
      label: role === 'admin' ? 'Admin' : customerAvailable ? 'Pesanan' : talentWorkspaceAvailable ? 'Dashboard' : 'Menu',
      route: ordersRoute,
      icon: <Bookmark className={icon} strokeWidth={2.1} />,
      onPress: () => {
        if (!loggedIn) {
          onNavigate('/login');
        } else if (ordersRoute) {
          onNavigate(ordersRoute);
        } else {
          window.dispatchEvent(new CustomEvent('yuku:open-menu'));
        }
      },
    },
    { label: 'Profil', route: null, icon: <User className={icon} strokeWidth={2.1} />, onPress: openProfile },
  ];

  const navShell =
    'md:hidden fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-40 mx-auto w-[calc(100%-16px)] sm:w-[calc(100%-24px)] max-w-[480px] rounded-[20px] sm:rounded-[24px] border border-[#32134F] bg-[#32134F] px-1.5 sm:px-2 py-0.5 shadow-[0_8px_24px_rgba(50,19,79,0.24)] backdrop-blur-2xl';

  if (isAuthLoading) {
    return (
      <nav aria-hidden="true" className={navShell}>
        <div className="grid min-h-[52px] grid-cols-5" />
      </nav>
    );
  }

  return (
    <nav aria-label="Menu utama HP" className={navShell}>
      <ul className="grid grid-cols-5 gap-0.5 sm:gap-1">
        {items.map((item) => {
          const active =
            item.route !== null &&
            (currentPath === item.route ||
              (item.route !== '/' && currentPath.startsWith(item.route)));

          return (
            <li key={item.label} className="min-w-0">
              <button
                type="button"
                onClick={item.onPress}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-[14px] sm:rounded-[18px] px-0.5 sm:px-1 py-1 text-[10px] sm:text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
                  active
                    ? 'bg-white text-[#32134F] shadow-[0_2px_8px_rgba(0,0,0,0.16)]'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`flex h-6 w-8 sm:h-7 sm:w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-[#32134F] text-white'
                    : 'text-white/75 group-hover:text-white'
                }`}>
                  {item.icon}
                </span>
                <span className="max-w-full truncate leading-none">{item.label}</span>
                {active && (
                  <span className="absolute -bottom-0.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-[#32134F]" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
