import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert, UserRoundX, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DeletionRequest {
  id: string;
  user_id: string;
  email_snapshot: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
}

export const AccountDeletionRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('account-deletion-admin', { body: { action: 'list' } });
    if (invokeError || !data?.success) setError(data?.error || invokeError?.message || 'Antrean belum dapat dimuat.');
    else setRequests(Array.isArray(data.requests) ? data.requests : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (request: DeletionRequest, status: 'under_review' | 'rejected') => {
    const note = (notes[request.id] || '').trim();
    if (status === 'rejected' && !note) { setError('Catatan alasan penolakan wajib diisi.'); return; }
    if (status === 'under_review' && !window.confirm('Mulai pemeriksaan manual permintaan ini? Tidak ada data atau akun yang akan dihapus.')) return;
    if (status === 'rejected' && !window.confirm('Tolak permintaan ini? Pengguna dapat mengajukan ulang setelahnya.')) return;
    setBusyId(request.id); setError(''); setMessage('');
    const { data, error: invokeError } = await supabase.functions.invoke('account-deletion-admin', {
      body: { action: 'review', requestId: request.id, status, note },
    });
    if (invokeError || !data?.success) setError(data?.error || invokeError?.message || 'Perubahan status gagal.');
    else { setMessage(status === 'under_review' ? 'Permintaan masuk pemeriksaan manual.' : 'Permintaan ditolak dan alasannya dicatat.'); await load(); }
    setBusyId(null);
  };

  const active = requests.filter((r) => r.status === 'pending' || r.status === 'under_review');
  const decided = requests.filter((r) => r.status === 'approved' || r.status === 'rejected');

  return <section className="space-y-4">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2.5"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div>
        <h3 className="text-sm font-black text-amber-950">Pemeriksaan permintaan penghapusan akun</h3>
        <p className="mt-1 text-xs leading-relaxed text-amber-900">Menu ini hanya untuk Super Admin. Status pemeriksaan tidak menghapus akun. Sebelum keputusan akhir, periksa booking aktif, pembayaran, refund, saldo/payout, sengketa, identitas, kewajiban hukum, dan retensi audit secara manual.</p>
      </div></div>
    </div>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
    {message && <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}
    <div className="flex items-center justify-between gap-2"><div className="text-xs text-slate-500">{active.length} permintaan aktif · {decided.length} keputusan terakhir</div><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Muat ulang</button></div>
    {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Memuat antrean...</div> :
      requests.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">Belum ada permintaan penghapusan akun.</div> :
      <div className="space-y-3">{requests.map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="break-all text-sm font-bold text-slate-900">{request.email_snapshot || 'Email tidak tersedia'}</p><p className="mt-1 text-[10px] text-slate-400">Diajukan {new Date(request.requested_at).toLocaleString('id-ID')} · ID {request.id.slice(0,8)}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${request.status === 'pending' ? 'bg-amber-100 text-amber-800' : request.status === 'under_review' ? 'bg-sky-100 text-sky-800' : request.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{request.status === 'pending' ? 'Menunggu' : request.status === 'under_review' ? 'Sedang ditinjau' : request.status === 'rejected' ? 'Ditolak' : 'Disetujui'}</span>
        </div>
        {request.admin_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Catatan: {request.admin_note}</p>}
        {(request.status === 'pending' || request.status === 'under_review') && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-xs font-bold text-slate-700" htmlFor={`deletion-note-${request.id}`}>Catatan pemeriksaan / alasan penolakan</label>
          <textarea id={`deletion-note-${request.id}`} rows={2} maxLength={2000} value={notes[request.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [request.id]: e.target.value }))} className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-purple-500" placeholder="Catat hasil pengecekan booking, pembayaran, saldo, sengketa, identitas, dan retensi..." />
          <div className="flex flex-wrap gap-2">
            {request.status === 'pending' && <button onClick={() => void review(request, 'under_review')} disabled={busyId !== null} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Clock3 className="h-4 w-4" />Mulai pemeriksaan</button>}
            <button onClick={() => void review(request, 'rejected')} disabled={busyId !== null || !(notes[request.id] || '').trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle className="h-4 w-4" />Tolak permintaan</button>
            {busyId === request.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </div>}
      </article>)}</div>}
    <p className="text-[11px] leading-5 text-slate-500">Penghapusan permanen tetap dilakukan melalui proses terpisah setelah pemeriksaan dan persetujuan yang sah. Panel ini tidak menyediakan tombol hapus permanen.</p>
  </section>;
};
