import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DeletionRequest {
  id: string;
  status: 'pending' | 'under_review';
  requested_at: string;
}

export const AccountDeletionPage: React.FC = () => {
  const { user, isAuthLoading } = useAuth();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadStatus = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke('account-deletion-request', {
      body: { action: 'status' },
    });
    if (error || !data?.success) {
      setErrorMessage(data?.error || 'Status permintaan belum dapat dimuat. Coba muat ulang halaman.');
    } else {
      setRequest(data.request || null);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isAuthLoading) void loadStatus();
  }, [isAuthLoading, loadStatus]);

  const submitRequest = async () => {
    if (!user || confirmation.trim() !== 'AJUKAN HAPUS AKUN') return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    const { data, error } = await supabase.functions.invoke('account-deletion-request', {
      body: { action: 'submit' },
    });
    if (error || !data?.success) {
      setErrorMessage(data?.error || 'Permintaan belum berhasil dikirim. Silakan coba lagi.');
    } else {
      setRequest(data.request);
      setSuccessMessage(data.alreadyPending
        ? 'Permintaan penghapusan akun Anda sudah tercatat dan sedang menunggu pemeriksaan.'
        : 'Permintaan penghapusan akun berhasil dikirim. Tim YUKU akan memeriksa kewajiban transaksi dan retensi data sebelum tindak lanjut.');
      setConfirmation('');
    }
    setIsSubmitting(false);
  };

  if (isAuthLoading || isLoading) {
    return <div className="min-h-[55vh] flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin" />Memeriksa akun...</div>;
  }

  if (!user) {
    return (
      <main className="min-h-[65vh] bg-[#FAF8FC] px-4 py-12">
        <section className="mx-auto max-w-xl rounded-3xl border border-violet-100 bg-white p-6 shadow-xl">
          <ShieldCheck className="h-8 w-8 text-violet-700" />
          <h1 className="mt-3 text-2xl font-black text-[#1E0938]">Pengajuan Hapus Akun YUKU</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Untuk melindungi akun, silakan login ke akun YUKU yang ingin diajukan penghapusannya. Setelah login, buka kembali halaman ini.</p>
          <a href="/login" className="mt-5 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">Login ke YUKU</a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[65vh] bg-[radial-gradient(ellipse_at_top,_rgba(237,233,254,0.8),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F5FB_100%)] px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_24px_70px_-35px_rgba(76,29,149,0.35)]">
        <div className="bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-900 p-6 text-white sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Trash2 className="h-6 w-6" /></div>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">Pengajuan Hapus Akun</h1>
          <p className="mt-2 text-sm leading-6 text-violet-100">Ajukan penutupan akun YUKU melalui proses resmi dan aman.</p>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          {errorMessage && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{errorMessage}</div>}
          {successMessage && <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{successMessage}</div>}

          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Akun yang diajukan</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-900">{user.email || 'Email tidak tersedia'}</p>
          </div>

          {request ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900"><Clock3 className="h-5 w-5" />Permintaan sedang diproses</div>
              <p className="mt-2 text-sm leading-6 text-amber-900">Pengajuan Anda sudah tercatat sejak {new Date(request.requested_at).toLocaleString('id-ID')}. Tim YUKU akan memeriksa transaksi, saldo, sengketa, dan kewajiban penyimpanan data sebelum mengambil keputusan.</p>
              <p className="mt-2 text-xs text-amber-800">Status: {request.status === 'under_review' ? 'Sedang ditinjau' : 'Menunggu pemeriksaan'}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-sm leading-6 text-slate-600">
                <p><strong className="text-slate-900">Apa yang terjadi setelah diajukan?</strong></p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Tim YUKU memeriksa booking aktif, pembayaran, refund, saldo, dan sengketa.</li>
                  <li>Catatan transaksi, identitas, keamanan, dan data yang wajib disimpan dapat dipertahankan sesuai kewajiban hukum.</li>
                  <li>Pengajuan ini belum menghapus akun atau data secara otomatis.</li>
                </ul>
              </div>
              <div>
                <label htmlFor="deletion-confirmation" className="mb-2 block text-sm font-bold text-slate-800">Ketik AJUKAN HAPUS AKUN untuk mengirim permintaan</label>
                <input id="deletion-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder="AJUKAN HAPUS AKUN" />
              </div>
              <button type="button" onClick={() => void submitRequest()} disabled={isSubmitting || confirmation.trim() !== 'AJUKAN HAPUS AKUN'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isSubmitting ? 'Mengirim permintaan...' : 'Kirim Permintaan Penghapusan'}
              </button>
            </>
          )}
          <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Jika Anda tidak dapat login, hubungi <a href="mailto:yukufriends@gmail.com" className="font-semibold text-violet-700 underline">yukufriends@gmail.com</a> dari email yang terdaftar dan sertakan permintaan penghapusan akun.</p>
        </div>
      </section>
    </main>
  );
};
