import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AppRoute } from '../types/navigation';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface AdminInviteSetupPageProps {
  onNavigate: (path: AppRoute) => void;
}

export const AdminInviteSetupPage: React.FC<AdminInviteSetupPageProps> = ({ onNavigate }) => {
  const { user, adminAccess, isAuthLoading, refreshRole } = useAuth();
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const userId = user?.id;
  const authorized = Boolean(userId && adminAccess);

  useEffect(() => {
    let mounted = true;

    const verifyInviteSession = async () => {
      // AuthContext owns session restoration. Wait for it before checking Admin access.
      if (isAuthLoading) return;

      if (!userId) {
        setError('Sesi undangan tidak ditemukan. Pastikan tautan undangan masih berlaku.');
        setChecking(false);
        return;
      }

      if (adminAccess) {
        setError('');
        setChecking(false);
        return;
      }

      // The invitation email may arrive before Admin provisioning finishes.
      // Refresh through AuthContext and retry briefly; access is granted only
      // when AuthContext confirms the Admin permission from the database.
      const maxAttempts = 20;
      const retryDelayMs = 1000;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!mounted) return;

        try {
          await refreshRole();
        } catch {
          // Retry transient session/provisioning errors; never grant access here.
        }

        if (!mounted) return;

        // AuthContext state updates trigger a render and this effect will run again.
        if (userId && adminAccess) {
          setError('');
          setChecking(false);
          return;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => window.setTimeout(resolve, retryDelayMs));
        }
      }

      if (mounted) {
        setError('Undangan belum dapat diverifikasi. Pastikan tautan masih berlaku. Jika masalah berlanjut, minta Super Admin memeriksa status undangan.');
        setChecking(false);
      }
    };

    void verifyInviteSession();
    return () => {
      mounted = false;
    };
  }, [isAuthLoading, userId, adminAccess, refreshRole]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!user || !adminAccess) {
      setError('Akses Admin tidak ditemukan. Silakan buka kembali tautan undangan.');
      return;
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Refresh the shared auth state, then independently confirm the Admin
      // permission before showing the dashboard action.
      await refreshRole();
      const { data: access, error: accessError } = await supabase.rpc('get_admin_access');
      if (accessError || access?.is_admin !== true) {
        throw new Error('Kata sandi tersimpan, tetapi akses Admin belum dapat diverifikasi. Hubungi Super Admin.');
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kata sandi. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative isolate min-h-[65vh] overflow-hidden py-12 px-4 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(237,233,254,0.85),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F5FB_100%)]">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/90 bg-white/80 p-6 shadow-[0_28px_80px_-30px_rgba(76,29,149,0.34)] ring-1 ring-violet-100/80 backdrop-blur-2xl sm:p-8 space-y-6">
        <div className="text-center space-y-3">
          <BrandLogo size="md" showTagline={false} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[11px] font-bold text-purple-800">
            Aktivasi Admin YUKU
          </div>
          <h1 className="text-2xl font-black text-[#1E0938] tracking-tight">Buat Kata Sandi</h1>
          <p className="text-sm text-slate-500">Buat kata sandi pribadi untuk menyelesaikan aktivasi akun Admin.</p>
          {user?.email && <p className="text-xs font-semibold text-slate-700">{user.email}</p>}
        </div>

        {checking ? (
          <p className="text-center text-sm text-slate-500">Memverifikasi undangan...</p>
        ) : error && !authorized ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><p>{error}</p>
            </div>
            <button type="button" onClick={() => onNavigate('/login')} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-700 text-white font-bold text-sm shadow-[0_12px_26px_-10px_rgba(126,34,206,0.55)] transition-all hover:-translate-y-0.5">Ke Halaman Login</button>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Kata sandi berhasil dibuat. Aktivasi selesai dan akses Admin sudah diverifikasi.</p>
            </div>
            <button type="button" onClick={() => onNavigate('/admin')} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-700 text-white font-bold text-sm shadow-[0_12px_26px_-10px_rgba(126,34,206,0.55)] transition-all hover:-translate-y-0.5 inline-flex items-center justify-center gap-2">
              Buka Dashboard Admin <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : authorized ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-700">Kata Sandi Baru</span>
              <span className="relative block">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter" className="w-full pl-9 pr-11 py-3.5 rounded-2xl border border-violet-100 bg-white/85 shadow-inner text-sm transition-all focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-700">Konfirmasi Kata Sandi</span>
              <span className="relative block">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input required minLength={8} type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ulangi kata sandi" className="w-full pl-9 pr-11 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showConfirm ? 'Sembunyikan konfirmasi' : 'Lihat konfirmasi'}>{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </span>
            </label>
            <button type="submit" disabled={saving} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-700 text-white font-bold text-sm shadow-[0_12px_26px_-10px_rgba(126,34,206,0.55)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0">{saving ? 'Menyimpan...' : 'Simpan Kata Sandi & Aktifkan Akun'}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
};
