import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppRoute } from '../../types/navigation';

type TotpFactor = {
  id: string;
  status: 'verified' | 'unverified';
  friendly_name?: string;
};

type AdminMfaGateProps = {
  onVerified: () => void;
  onNavigate: (path: AppRoute) => void;
};

type Phase = 'loading' | 'setup' | 'pending' | 'enroll' | 'challenge' | 'error';

export const AdminMfaGate: React.FC<AdminMfaGateProps> = ({ onVerified, onNavigate }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingFactors, setPendingFactors] = useState<TotpFactor[]>([]);

  const loadMfaState = useCallback(async () => {
    setPhase('loading');
    setErrorMessage('');

    const [aalResult, factorsResult] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    if (aalResult.error) throw aalResult.error;
    if (factorsResult.error) throw factorsResult.error;

    if (aalResult.data.currentLevel === 'aal2') {
      onVerified();
      return;
    }

    const verifiedFactors = (factorsResult.data.totp || []).filter(
      (factor) => factor.status === 'verified',
    ) as TotpFactor[];
    const unverifiedFactors = (factorsResult.data.totp || []).filter(
      (factor) => factor.status === 'unverified',
    ) as TotpFactor[];

    if (verifiedFactors.length > 0) {
      setFactorId(verifiedFactors[0].id);
      setPhase('challenge');
      return;
    }

    setPendingFactors(unverifiedFactors);
    setPhase(unverifiedFactors.length > 0 ? 'pending' : 'setup');
  }, [onVerified]);

  useEffect(() => {
    let active = true;
    void loadMfaState().catch((error: unknown) => {
      if (!active) return;
      setErrorMessage(error instanceof Error ? error.message : 'Tidak dapat memeriksa keamanan akun.');
      setPhase('error');
    });
    return () => {
      active = false;
    };
  }, [loadMfaState]);

  const startEnrollment = async () => {
    setBusy(true);
    setErrorMessage('');
    try {
      // Hapus hanya faktor TOTP yang belum selesai didaftarkan, agar Admin
      // dapat mengulang proses bila QR sebelumnya sudah tidak tersimpan.
      for (const factor of pendingFactors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'YUKU Admin - Google Authenticator',
      });
      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setCode('');
      setPhase('enroll');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyiapkan Google Authenticator.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('Masukkan kode 6 digit dari Google Authenticator.');
      return;
    }

    setBusy(true);
    setErrorMessage('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal.currentLevel !== 'aal2') {
        throw new Error('Verifikasi belum mencapai tingkat keamanan kedua. Silakan coba lagi.');
      }

      onVerified();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kode verifikasi tidak cocok atau sudah kedaluwarsa.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    onNavigate('/login');
  };

  if (phase === 'loading') {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-700 mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Memeriksa verifikasi keamanan Admin...</p>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 flex items-center justify-center bg-[#FAF8FC] min-h-[65vh]">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-[#1E0938]">Verifikasi Keamanan Admin</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Akun Admin YUKU wajib menggunakan verifikasi dua langkah sebelum membuka dashboard.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {phase === 'setup' && (
          <div className="space-y-4 text-center">
            <Smartphone className="w-8 h-8 text-purple-700 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Aktifkan Google Authenticator</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hubungkan aplikasi Google Authenticator ke akun Admin ini. Setelah dipasang, setiap login Admin akan meminta kode 6 digit.
            </p>
            <button onClick={startEnrollment} disabled={busy} className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold disabled:opacity-50">
              {busy ? 'Menyiapkan...' : 'Mulai Pengaturan 2FA'}
            </button>
          </div>
        )}

        {phase === 'pending' && (
          <div className="space-y-4 text-center">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Pengaturan sebelumnya belum selesai</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ada pengaturan Authenticator yang belum diverifikasi. Ulangi pengaturan agar QR baru dapat dipindai.
            </p>
            <button onClick={startEnrollment} disabled={busy} className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold disabled:opacity-50">
              {busy ? 'Menyiapkan...' : 'Ulangi Pengaturan'}
            </button>
          </div>
        )}

        {phase === 'enroll' && (
          <div className="space-y-4 text-center">
            <p className="text-sm font-bold text-slate-800">1. Pindai QR dengan Google Authenticator</p>
            <div className="mx-auto w-52 h-52 p-2 border border-slate-200 rounded-xl flex items-center justify-center bg-white">
              {qrCode && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`} alt="QR Google Authenticator YUKU" className="w-full h-full" />}
            </div>
            <details className="text-left text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold">Tidak bisa memindai QR? Lihat kunci manual</summary>
              <p className="mt-2 p-3 rounded-lg bg-slate-50 break-all font-mono select-all">{secret}</p>
            </details>
            <p className="text-xs text-slate-500">2. Masukkan kode 6 digit yang muncul di aplikasi.</p>
            <form onSubmit={verifyCode} className="space-y-3">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] text-xl font-bold py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600"
              />
              <button type="submit" disabled={busy || code.length !== 6} className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold disabled:opacity-50">
                {busy ? 'Memverifikasi...' : 'Aktifkan dan Verifikasi'}
              </button>
            </form>
          </div>
        )}

        {phase === 'challenge' && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <LockKeyhole className="w-8 h-8 text-purple-700 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Masukkan kode Authenticator</p>
              <p className="text-xs text-slate-500">Buka Google Authenticator dan masukkan kode 6 digit untuk melanjutkan ke dashboard Admin.</p>
            </div>
            <form onSubmit={verifyCode} className="space-y-3">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                className="w-full text-center tracking-[0.5em] text-xl font-bold py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600"
              />
              <button type="submit" disabled={busy || code.length !== 6} className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold disabled:opacity-50">
                {busy ? 'Memeriksa...' : 'Verifikasi dan Masuk'}
              </button>
            </form>
          </div>
        )}

        {phase === 'error' && (
          <div className="text-center space-y-3">
            <p className="text-xs text-slate-600">Pemeriksaan keamanan gagal. Silakan coba lagi atau keluar dari akun.</p>
            <button onClick={() => void loadMfaState().catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Pemeriksaan gagal.'))} className="w-full py-3 rounded-xl bg-purple-700 text-white text-xs font-bold">Coba Lagi</button>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Perlindungan akun Admin</span>
          <button type="button" onClick={signOut} disabled={busy} className="text-xs font-bold text-slate-600 hover:text-purple-700 disabled:opacity-50">Keluar</button>
        </div>
      </div>
    </div>
  );
};
