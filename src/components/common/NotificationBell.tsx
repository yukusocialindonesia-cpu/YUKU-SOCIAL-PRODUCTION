import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  CreditCard,
  ShieldAlert,
  Gift,
  Wallet,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { NotificationRow, NotificationType } from '../../types/database';
import { AppRoute } from '../../types/navigation';
import { PushNotificationToggle } from './PushNotificationToggle';

interface NotificationBellProps {
  userId: string;
  userRole?: string | null;
  onNavigate: (path: AppRoute) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  userRole,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Prevent a late response for a previous account from populating this bell
  // after a shared-device account switch or sign-out/sign-in race.
  const activeUserIdRef = useRef(userId);
  const notificationLoadIdRef = useRef(0);

  const playNotificationSound = useCallback(async (type: NotificationType, force = false) => {
    if ((!soundEnabled && !force) || typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      // Mobile browsers often keep AudioContext suspended until a user gesture.
      if (audioContext.state === 'suspended') await audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const frequencies: Record<string, number> = {
        booking_update: 660,
        payment_status: 880,
        payout_status: 740,
        referral_bonus: 990,
        system_alert: 520,
      };

      oscillator.type = 'sine';
      oscillator.frequency.value = frequencies[type] ?? 660;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.24);
      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch {
      // Audio may be blocked until the user interacts with the page.
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      setSoundEnabled(window.localStorage.getItem('yuku-notification-sound') === 'on');
    } catch {
      setSoundEnabled(false);
    }
  }, []);

  const loadNotifications = useCallback(async (playForNew = false) => {
    const requestedUserId = userId;
    if (!requestedUserId || activeUserIdRef.current !== requestedUserId) return;
    const requestId = ++notificationLoadIdRef.current;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, is_read, metadata, created_at')
        .eq('user_id', requestedUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Ignore responses started under an older account or superseded request.
      if (
        requestId !== notificationLoadIdRef.current ||
        activeUserIdRef.current !== requestedUserId
      ) return;

      if (!error && data) {
        const rows = data as NotificationRow[];
        const previousIds = seenNotificationIds.current;
        if (previousIds && playForNew) {
          const newest = rows.find((item) => !item.is_read && !previousIds.has(item.id));
          if (newest) playNotificationSound(newest.type);
        }
        seenNotificationIds.current = new Set(rows.map((item) => item.id));
        setNotifications(rows);
      }
    } finally {
      if (
        requestId === notificationLoadIdRef.current &&
        activeUserIdRef.current === requestedUserId
      ) setIsLoading(false);
    }
  }, [userId, playNotificationSound]);

  useEffect(() => {
    activeUserIdRef.current = userId;
    // Invalidate in-flight requests before clearing the previous account's data.
    notificationLoadIdRef.current += 1;
    seenNotificationIds.current = null;
    setNotifications([]);
    setIsLoading(false);

    if (!userId) return;
    loadNotifications();
    // Nama channel harus unik per komponen; dua lonceng dengan userId sama
    // sebelumnya memakai channel yang sama dan membuat aplikasi crash.
    const channelName = `user-notifications-${userId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications(true);
        }
      )
      .subscribe();

    return () => {
      // Any pending fetch from this account must not update a later account's UI.
      notificationLoadIdRef.current += 1;
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const openBell = () => setIsOpen(true);
    window.addEventListener('yuku:open-notifications', openBell);
    return () => window.removeEventListener('yuku:open-notifications', openBell);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getTargetRoute = (item: NotificationRow): AppRoute | null => {
    const metaRoute = item.metadata?.route;
    if (typeof metaRoute === 'string' && metaRoute.startsWith('/')) {
      return metaRoute as AppRoute;
    }

    switch (item.type) {
      case 'booking_update':
      case 'payment_status':
        return userRole === 'talent' ? '/dashboard-talent' : '/riwayat-booking';
      case 'payout_status':
      case 'referral_bonus':
        return '/dashboard-talent';
      case 'system_alert':
        if (item.title.toLowerCase().includes('ktp')) {
          return userRole === 'talent' ? '/dashboard-talent' : '/verifikasi-ktp';
        }
        return userRole === 'talent' ? '/dashboard-talent' : '/riwayat-booking';
      default:
        return null;
    }
  };

  const handleNotificationClick = async (item: NotificationRow) => {
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.id)
        .eq('user_id', userId);
    }

    const targetRoute = getTargetRoute(item);
    if (targetRoute) {
      setIsOpen(false);
      onNavigate(targetRoute);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (!error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } finally {
      setIsMarkingAll(false);
    }
  };

  const renderIcon = (type: NotificationType) => {
    switch (type) {
      case 'booking_update':
        return <Calendar className="w-4 h-4 text-purple-700" />;
      case 'payment_status':
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'payout_status':
        return <Wallet className="w-4 h-4 text-amber-600" />;
      case 'referral_bonus':
        return <Gift className="w-4 h-4 text-fuchsia-600" />;
      case 'system_alert':
      default:
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) loadNotifications();
        }}
        className="relative rounded-2xl border border-purple-100/80 bg-white/85 p-2.5 text-slate-700 shadow-[0_8px_22px_rgba(76,29,149,0.09)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-900 cursor-pointer"
        aria-label="Notifikasi"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.4rem] border border-white/90 bg-white/95 shadow-[0_24px_70px_rgba(36,12,64,0.2)] ring-1 ring-purple-100/80 backdrop-blur-2xl sm:w-96">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100/80 bg-[linear-gradient(135deg,rgba(250,245,255,0.98),rgba(255,255,255,0.96))] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-bold">
                  {unreadCount} baru
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                try {
                  window.localStorage.setItem('yuku-notification-sound', next ? 'on' : 'off');
                } catch {
                  // Keep the preference for this session if storage is unavailable.
                }
                if (next) void playNotificationSound('booking_update', true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-purple-800 cursor-pointer"
              aria-label={soundEnabled ? 'Matikan suara notifikasi' : 'Aktifkan suara notifikasi'}
              title={soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi mati'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Suara aktif' : 'Suara mati'}</span>
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai semua dibaca</span>
              </button>
            )}
          </div>

          <PushNotificationToggle />

          <div className="max-h-96 divide-y divide-purple-50/90 overflow-y-auto bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAFF_100%)]">
            {isLoading && notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
                <span>Memuat notifikasi...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="space-y-2 px-5 py-12 text-center">
                <Bell className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Belum ada notifikasi baru</p>
                <p className="text-[11px] text-slate-400">
                  Pembaruan booking, pengajuan jasa profesional, verifikasi e-KTP, dan pencairan dana akan muncul di sini.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-all duration-200 ${
                    item.is_read
                      ? 'bg-white/70 hover:bg-purple-50/70'
                      : 'bg-purple-50/80 shadow-[inset_3px_0_0_rgba(147,51,234,0.75)] hover:bg-purple-100/70'
                  }`}
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-purple-100 bg-white shadow-[0_6px_16px_rgba(76,29,149,0.09)]">
                    {renderIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </p>
                      {!item.is_read && (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 shadow-[0_0_0_3px_rgba(216,180,254,0.28)]" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatTime(item.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
