import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { disableYukuPush, enableYukuPush, getYukuPushStatus } from '../../lib/webPush';
import { useAuth } from '../../contexts/AuthContext';

type PushStatus = 'checking' | 'unsupported' | 'enabled' | 'disabled' | 'permission-denied';

export const PushNotificationToggle: React.FC = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [status, setStatus] = useState<PushStatus>('checking');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshStatus = async () => {
    const next = await getYukuPushStatus();
    setStatus(next);
  };

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let active = true;
    void getYukuPushStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, [isAuthLoading, isAuthenticated]);

  const handleToggle = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setMessage('');
    try {
      const result = status === 'enabled'
        ? await disableYukuPush()
        : await enableYukuPush();
      setMessage(result.message);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsBusy(false);
    }
  };

  const unavailable = status === 'unsupported' || status === 'permission-denied';

  if (isAuthLoading || !isAuthenticated) return null;

  return (
    <div className="mx-3 my-3 rounded-xl border border-purple-100 bg-purple-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">Notifikasi di HP</p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {status === 'checking' ? 'Memeriksa perangkat...' :
              status === 'enabled' ? 'Aktif di perangkat ini' :
              status === 'permission-denied' ? 'Izin diblokir di pengaturan browser' :
              status === 'unsupported' ? 'Browser ini belum mendukung push' :
              'Terima kabar meski YUKU tidak sedang dibuka'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={isBusy || status === 'checking' || unavailable}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy || status === 'checking'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : status === 'enabled'
              ? <BellOff className="h-3.5 w-3.5" />
              : <BellRing className="h-3.5 w-3.5" />}
          {isBusy ? 'Tunggu...' : status === 'enabled' ? 'Matikan' : 'Aktifkan'}
        </button>
      </div>
      {message && <p role="status" className="mt-2 text-[11px] text-slate-600">{message}</p>}
    </div>
  );
};
