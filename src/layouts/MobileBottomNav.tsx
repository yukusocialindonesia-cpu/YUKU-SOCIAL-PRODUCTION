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

/** Navigasi HP ringkas; route dan hak akses tetap mengikuti role yang ada. */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath, onNavigate }) => {
  const { user, role, isAuthLoading } = useAuth();
  const loggedIn = Boolean(user);
  const icon = 'w-5 h-5';
  const ordersRoute: AppRoute | null =
    role === 'admin' ? '/admin' : role === 'talent' ? '/dashboard-talent' : role === 'customer' ? '/riwayat-booking' : null;

  const openProfile = () => {
    if (!loggedIn) {
      onNavigate('/login');
      return;
    }
    if (role === 'admin') onNavigate('/admin');
    else if (role === 'talent') onNavigate('/dashboard-talent');
    else if (role === 'customer') onNavigate('/profil-saya');
    else window.dispatchEvent(new CustomEvent('yuku:open-menu'));
  };

  const items: NavEntry[] = [
    { label: 'Beranda', route: '/', icon: <Home className={icon} strokeWidth={2.1} />, onPress: () => onNavigate('/') },
    { label: 'Jelajahi', route: '/talent', icon: <Search className={icon} strokeWidth={2.1} />, onPress: () => onNavigate('/talent') },
    { label: 'Komunitas', route: '/komunitas', icon: <Users className={icon} strokeWidth={2.1} />, onPress: () => onNavigate('/komunitas') },
    {
      label: role === 'admin' ? 'Admin' : role === 'talent' ? 'Dashboard' : role === 'customer' ? 'Pesanan' : 'Menu',
      route: ordersRoute,
      icon: <Bookmark className={icon} strokeWidth={2.1} />,
      onPress: () => {
        if (!loggedIn) onNavigate('/login');
        else if (ordersRoute) onNavigate(ordersRoute);
        else window.dispatchEvent(new CustomEvent('yuku:open-menu'));
      },
    },
    { label: 'Profil', route: null, icon: <User className={icon} strokeWidth={2.1} />, onPress: openProfile },
  ];

  const navShell =
    'md:hidden fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 mx-auto w-[calc(100%-20px)] max-w-[520px] rounded-[20px] border border-white/85 bg-white/90 px-1.5 py-1 shadow-[0_10px_28px_rgba(48,15,92,0.16)] backdrop-blur-2xl';

  if (isAuthLoading) {
    return <nav aria-hidden="true" className={navShell}><div className="grid h-[54px] grid-cols-5" /></nav>;
  }

  return (
    <nav aria-label="Menu utama HP" className={navShell}>
      <ul className="grid grid-cols-5 gap-0.5">
        {items.map((item) => {
          const active =
            item.route !== null &&
            (currentPath === item.route || (item.route !== '/' && currentPath.startsWith(item.route)));

          return (
            <li key={item.label} className="min-w-0">
              <button
                type="button"
                onClick={item.onPress}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex h-[54px] w-full flex-col items-center justify-center gap-1 rounded-[15px] px-0.5 text-[10px] font-semibold transition-colors active:scale-95 ${
                  active ? 'bg-purple-50 text-purple-800' : 'text-slate-500 hover:bg-purple-50/70 hover:text-purple-700'
                }`}
              >
                <span className={`flex h-6 items-center justify-center ${active ? 'text-purple-700' : 'text-slate-500 group-hover:text-purple-700'}`}>
                  {item.icon}
                </span>
                <span className="max-w-full truncate leading-none">{item.label}</span>
                {active && <span className="absolute bottom-0 h-1 w-5 rounded-full bg-gradient-to-r from-purple-700 to-fuchsia-500" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
