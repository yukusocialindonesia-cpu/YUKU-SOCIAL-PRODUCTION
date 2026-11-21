import React from 'react';
import { Home, Search, Bookmark, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';

interface MobileBottomNavProps {
  currentPath: string;
  onNavigate: (path: AppRoute) => void;
}

type NavEntry = { label: string; route: AppRoute | null; icon: React.ReactNode; onPress: () => void };

/**
 * Menu bawah khusus HP (disembunyikan di layar md ke atas).
 * Isi menu menyesuaikan status login dan peran pengguna.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath, onNavigate }) => {
  const { user, role, isAuthLoading } = useAuth();
  const loggedIn = Boolean(user);

  const icon = 'w-6 h-6';
  const ordersRoute: AppRoute =
    role === 'admin' ? '/admin' : role === 'talent' ? '/dashboard-talent' : '/riwayat-booking';

  const openProfile = () => {
    if (!loggedIn) {
      onNavigate('/login');
      return;
    }

    // Arahkan langsung ke halaman utama sesuai peran akun.
    if (role === 'admin') {
      onNavigate('/admin');
    } else if (role === 'talent') {
      onNavigate('/dashboard-talent');
    } else {
      onNavigate('/profil-saya');
    }
  };

  const items: NavEntry[] = [
    { label: 'Beranda', route: '/', icon: <Home className={icon} />, onPress: () => onNavigate('/') },
    { label: 'Cari', route: '/talent', icon: <Search className={icon} />, onPress: () => onNavigate('/talent') },
    {
      label: role === 'admin' ? 'Admin' : role === 'talent' ? 'Dashboard' : 'Pesanan',
      route: ordersRoute,
      icon: <Bookmark className={icon} />,
      onPress: () => onNavigate(loggedIn ? ordersRoute : '/login'),
    },
    { label: 'Profil', route: null, icon: <User className={icon} />, onPress: openProfile },
  ];

  // Selama auth belum siap, sisakan ruang kosong dengan tinggi yang sama (tanpa label apa pun).
  if (isAuthLoading) {
    return (
      <nav
        aria-hidden="true"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-purple-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="min-h-[56px]" />
      </nav>
    );
  }

  return (
    <nav
      aria-label="Menu utama HP"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-purple-100 shadow-[0_-4px_16px_rgba(76,29,149,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.route !== null && currentPath === item.route && (loggedIn || item.route === '/' || item.route === '/talent');
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={item.onPress}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full flex flex-col items-center justify-center gap-0.5 min-h-[56px] pt-2 pb-2.5 text-xs font-semibold transition-colors ${
                  active ? 'text-purple-700' : 'text-slate-500 hover:text-purple-600'
                }`}
              >
                {item.icon}
                {item.label}
                {active && <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-full bg-purple-700" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
