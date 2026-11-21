import React, { useEffect, useState } from 'react';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AppRoute } from '../types/navigation';
import { supabase } from '../lib/supabase';

interface ResetPasswordPageProps {
  onNavigate: (path: AppRoute) => void;
  initialRecoveryActive?: boolean;
}

function translateRecoveryError(message?: string): string {
  const msg = (message || '').toLowerCase();
  if (msg.includes('different from the old password') || msg.includes('same password')) {
    return 'Kata sandi baru harus berbeda dari kata sandi sebelumnya.';
  }
  if (msg.includes('at least') || msg.includes('weak')) {
    return 'Kata sandi baru terlalu lemah. Gunakan minimal 8 karakter yang kuat.';
  }
  if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
    return 'Sesi reset kata sandi tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.';
  }
  return message || 'Gagal mengatur ulang kata sandi. Silakan coba lagi.';
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onNavigate,
  initialRecoveryActive = false,
}) => {
  const [isCheckingSession, setIsCheckingSession] = useState(!initialRecoveryActive);
  const [hasRecoverySession, setHasRecoverySession] = useState(initialRecoveryActive);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (initialRecoveryActive) {
      setHasRecoverySession(true);
      setIsCheckingSession(false);
    }
  }, [initialRecoveryActive]);

  useEffect(() => {
    let isMounted = true;
    let recoveryDetected = initialRecoveryActive;

    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const searchParams = new URLSearchParams(search);

    const hasErrorInUrl =
      Boolean(hashParams.get('error')) ||
      Boolean(hashParams.get('error_code')) ||
      Boolean(searchParams.get('error')) ||
      Boolean(searchParams.get('error_code'));

    if (hasErrorInUrl) {
      setHasRecoverySession(false);
      setIsCheckingSession(false);
      return;
    }

    const hasRecoveryParam =
      hashParams.get('type') === 'recovery' ||
      searchParams.get('type') === 'recovery';

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryDetected = true;
        setHasRecoverySession(true);
        setIsCheckingSession(false);
      } else if (event === 'SIGNED_OUT') {
        setHasRecoverySession(false);
      }
    });

    const hasAuthCode = Boolean(searchParams.get('code')) || Boolean(hashParams.get('access_token'));

    const fallbackTimer = window.setTimeout(() => {
      if (!isMounted || recoveryDetected) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted || recoveryDetected) return;
        if (hasRecoveryParam && session) {
          setHasRecoverySession(true);
        } else {
          setHasRecoverySession(false);
        }
        setIsCheckingSession(false);
      });
    }, hasAuthCode || hasRecoveryParam ? 800 : 150);

    return () => {
      isMounted = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('Kata sandi baru minimal harus 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(translateRecoveryError(error.message));
        return;
      }

      setSuccessMsg('Kata sandi berhasil diperbarui. Anda sekarang dapat masuk menggunakan kata sandi baru.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(translateRecoveryError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="relative isolate min-h-[45vh] overflow-hidden py-16 px-4 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(237,233,254,0.85),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F5FB_100%)]">
        <div className="text-xs font-semibold text-slate-500">Memverifikasi tautan reset kata sandi...</div>
      </div>
    );
  }

  return (
    <div className="relative isolate py-12 sm:py-16 px-4 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/80 via-[#FAF8FC] to-fuchsia-50/70">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/90 bg-white/85 p-6 shadow-[0_28px_80px_-30px_rgba(76,29,149,0.32)] ring-1 ring-purple-100/80 backdrop-blur-2xl sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <BrandLogo size="md" showTagline={false} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-100/90 text-[11px] font-bold text-purple-800 shadow-sm">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Pemulihan Akun</span>
          </div>
          <h1 className="text-2xl font-black text-[#1E0938] tracking-tight">
            Reset Kata Sandi
          </h1>
          <p className="text-xs text-slate-500">
            Buat kata sandi baru untuk akun YUKU Anda.
          </p>
        </div>

        {!hasRecoverySession && !successMsg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-900 text-xs flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Tautan reset kata sandi tidak valid atau sudah kedaluwarsa. Silakan ajukan permintaan reset kata sandi baru.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/lupa-sandi')}
              className="w-full py-3.5 bg-gradient-to-r from-purple-700 via-purple-700 to-fuchsia-700 hover:from-purple-800 hover:to-fuchsia-800 text-white font-bold text-xs rounded-2xl shadow-[0_12px_24px_-10px_rgba(126,34,206,0.7)] ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-12px_rgba(126,34,206,0.75)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span>Minta Tautan Reset Baru</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-900 text-xs flex items-start gap-2.5 shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {successMsg ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 text-xs flex items-start gap-2.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{successMsg}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="w-full py-3 bg-gradient-to-r from-purple-700 to-fuchsia-700 hover:from-purple-800 hover:to-fuchsia-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Masuk ke Akun</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Minimal 8 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-3 bg-white/80 border border-slate-200/80 rounded-2xl shadow-inner shadow-purple-950/[0.025] focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100/80 text-xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-700 transition-colors cursor-pointer"
                      aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Ulangi kata sandi baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi kata sandi' : 'Lihat konfirmasi kata sandi'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-700 via-purple-700 to-fuchsia-700 hover:from-purple-800 hover:to-fuchsia-800 text-white font-bold text-xs rounded-2xl shadow-[0_12px_24px_-10px_rgba(126,34,206,0.7)] ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-12px_rgba(126,34,206,0.75)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span>{loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
