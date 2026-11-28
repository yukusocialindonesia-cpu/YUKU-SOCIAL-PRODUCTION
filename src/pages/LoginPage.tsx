import React, { useState } from 'react';
import { BrandLogo } from '../components/common/BrandLogo';
import { Lock, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppRoute } from '../types/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isEmailNotConfirmed, translateAuthError } from '../lib/authErrors';
import { ResendConfirmation } from '../components/auth/ResendConfirmation';

interface LoginPageProps {
  onNavigate: (path: AppRoute) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { refreshRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setNeedsConfirmation(false);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(translateAuthError(error));
        setNeedsConfirmation(isEmailNotConfirmed(error));
      } else if (data.user) {
        const { data: userRow, error: userRowError } = await supabase
          .from('users')
          .select('role,account_status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (userRowError || !userRow) {
          // A transient profile-read failure must not revoke sessions on other devices.
          await supabase.auth.signOut({ scope: 'local' });
          setErrorMsg('Data akun belum dapat diverifikasi. Silakan coba lagi.');
          return;
        }
        if (userRow.account_status !== 'active' && userRow.account_status !== 'pending_verification') {
          await supabase.auth.signOut({ scope: 'global' });
          setErrorMsg('Status akun belum memenuhi syarat untuk masuk. Hubungi tim Support jika menurut lu ini keliru.');
          return;
        }

        // Jangan menganggap role yang kosong/tidak dikenal sebagai Customer.
        // Sesi lokal dihentikan sampai role akun dapat diverifikasi dengan benar.
        if (userRow.role !== 'admin' && userRow.role !== 'talent' && userRow.role !== 'customer') {
          await supabase.auth.signOut({ scope: 'local' });
          setErrorMsg('Role akun belum dapat diverifikasi. Silakan hubungi Support YUKU.');
          return;
        }

        // Jika ada isian pendaftaran talent yang tersimpan (dibuat sebelum konfirmasi email),
        // lanjutkan langsung ke formulir agar pengguna tidak tersesat di dashboard kosong.
        let hasTalentDraft = false;
        try {
          const rawDraft = localStorage.getItem('yuku_talent_registration_draft');
          if (rawDraft) {
            const draft = JSON.parse(rawDraft) as { email?: unknown };
            hasTalentDraft =
              typeof draft.email === 'string' &&
              draft.email.trim().toLowerCase() === (data.user.email || email).trim().toLowerCase();
          }
        } catch {
          // Draf rusak atau penyimpanan browser tidak tersedia: jangan gunakan draf.
        }

        const targetRoute: AppRoute =
          userRow.role === 'admin'
            ? '/admin'
            : hasTalentDraft && (userRow.role === 'customer' || userRow.role === 'talent')
            ? '/daftar-talent'
            : userRow.role === 'talent'
            ? '/dashboard-talent'
            : '/talent';

        await refreshRole();

        setSuccessMsg(`Selamat datang kembali, ${data.user.email}!`);
        // Navigasi langsung setelah autentikasi berhasil agar tidak kembali
        // ke halaman lama/default saat state aplikasi masih berpindah.
        onNavigate(targetRoute);
      }
    } catch (err: any) {
      setErrorMsg(translateAuthError(err) || 'Gagal masuk ke akun.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate py-12 sm:py-16 px-4 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/80 via-transparent to-fuchsia-50/70">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/90 bg-white/85 p-6 shadow-[0_28px_80px_-30px_rgba(76,29,149,0.32)] ring-1 ring-purple-100/80 backdrop-blur-2xl sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <BrandLogo size="md" showTagline={false} />
          <h1 className="text-2xl font-black text-[#1E0938] tracking-tight">
            Masuk ke Akun YUKU
          </h1>
          <p className="text-xs text-slate-500">
            Masuk untuk mengelola jadwal teman aktivitas atau profil Talent-mu.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-900 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {needsConfirmation && <ResendConfirmation email={email} />}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 text-xs flex items-start gap-2.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{successMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full pl-9 pr-3 py-3 bg-white/80 border border-slate-200/80 rounded-2xl shadow-inner shadow-purple-950/[0.025] focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100/80 text-xs transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Kata Sandi</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-xs"
              />
            </div>
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={() => onNavigate('/lupa-sandi')}
                className="min-h-11 inline-flex items-center text-[11px] font-bold text-purple-700 hover:text-fuchsia-700 hover:underline transition-colors cursor-pointer"
              >
                Lupa kata sandi?
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Sesi login tersimpan otomatis di perangkat ini.</span>
            <span className="text-slate-400">Verifikasi 18+</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-700 via-purple-700 to-fuchsia-700 hover:from-purple-800 hover:to-fuchsia-800 text-white font-bold text-xs rounded-2xl shadow-[0_12px_24px_-10px_rgba(126,34,206,0.7)] ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-12px_rgba(126,34,206,0.75)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span>{loading ? 'Memproses...' : 'Masuk Akun'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
          Belum punya akun YUKU?{' '}
          <button
            onClick={() => onNavigate('/register')}
            className="text-purple-700 font-bold hover:text-fuchsia-700 hover:underline transition-colors"
          >
            Daftar Sekarang
          </button>
        </div>
      </div>
    </div>
  );
};
