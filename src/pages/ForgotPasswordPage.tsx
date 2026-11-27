import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { AppRoute } from '../types/navigation';
import { supabase } from '../lib/supabase';

interface ForgotPasswordPageProps {
  onNavigate: (path: AppRoute) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');
    setErrorMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-sandi',
      });
      if (error) {
        // Pesan generik tetap menjaga privasi: tidak mengungkap apakah email terdaftar.
        setErrorMessage('Permintaan belum dapat diproses. Periksa koneksi lalu coba lagi.');
        return;
      }
      setStatusMessage('Jika email terdaftar, tautan reset sudah dikirim.');
    } catch {
      setErrorMessage('Permintaan belum dapat diproses. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate py-12 sm:py-16 px-4 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/80 via-[#FAF8FC] to-fuchsia-50/70">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/90 bg-white/85 p-6 shadow-[0_28px_80px_-30px_rgba(76,29,149,0.32)] ring-1 ring-purple-100/80 backdrop-blur-2xl sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <BrandLogo size="md" showTagline={false} />
          <h1 className="text-2xl font-black text-[#1E0938] tracking-tight">
            Lupa Kata Sandi
          </h1>
          <p className="text-xs text-slate-500">
            Masukkan email akun YUKU Anda untuk menerima tautan pengaturan ulang kata sandi.
          </p>
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 text-xs flex items-start gap-2.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{statusMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-900 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

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
                className="w-full pl-9 pr-3 py-3 bg-white/80 border border-slate-200/80 rounded-2xl shadow-inner shadow-purple-950/[0.025] focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100/80 text-xs transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-700 via-purple-700 to-fuchsia-700 hover:from-purple-800 hover:to-fuchsia-800 text-white font-bold text-xs rounded-2xl shadow-[0_12px_24px_-10px_rgba(126,34,206,0.7)] ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-12px_rgba(126,34,206,0.75)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span>{loading ? 'Mengirim...' : 'Kirim Tautan Reset'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center gap-1.5 text-purple-700 font-bold hover:text-fuchsia-700 hover:underline transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Halaman Masuk</span>
          </button>
        </div>
      </div>
    </div>
  );
};
