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
    'md:hidden fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-40 mx-auto w-[calc(100%-16px)] sm:w-[calc(100%-24px)] max-w-[480px] rounded-[20px] sm:rounded-[24px] border border-[#A78BFA]/35 bg-gradient-to-r from-[#32134F]/96 via-[#3b1a60]/96 to-[#32134F]/96 px-1.5 sm:px-2 py-0.5 shadow-[0_14px_38px_rgba(0,0,0,0.48),0_0_24px_rgba(155,93,216,0.16)] backdrop-blur-2xl';

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
                    ? 'bg-gradient-to-b from-[#A78BFA] to-[#7541C8] text-[#32134F] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_3px_12px_rgba(0,0,0,0.24)]'
                    : 'text-white/65 hover:bg-white/10 hover:text-[#A78BFA]'
                }`}
              >
                <span className={`flex h-6 w-8 sm:h-7 sm:w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-[#32134F]/70 text-white shadow-[0_3px_10px_rgba(0,0,0,0.20)]'
                    : 'text-white/65 group-hover:text-[#A78BFA]'
                }`}>
                  {item.icon}
                </span>
                <span className="max-w-full truncate leading-none">{item.label}</span>
                {active && (
                  <span className="absolute -bottom-0.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#A78BFA] to-[#7541C8]" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
