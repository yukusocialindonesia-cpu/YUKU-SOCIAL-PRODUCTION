import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCw, Save, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../utils/formatters';

export const BankTransferAdminPanel: React.FC = () => {
  const loadRequestIdRef = useRef(0);
  const [rows, setRows] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [bookingStatus, setBookingStatus] = useState<Record<string, string>>({});
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [instructions, setInstructions] = useState('Transfer tepat sesuai nominal booking, lalu unggah bukti pembayaran.');
  const [active, setActive] = useState(false);
  const [dialog, setDialog] = useState<{ row: any; approve: boolean } | null>(null);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const db = supabase as any;
    const [{ data: cfg, error: cfgError }, { data: submissions, error: submissionsError }] = await Promise.all([
      db.from('bank_transfer_settings').select('*').eq('id', true).maybeSingle(),
      db.from('bank_transfer_submissions').select('id,booking_id,customer_id,proof_storage_path,claimed_amount,transfer_reference,status,admin_notes,created_at,reviewed_at').order('created_at', { ascending: false }).limit(50),
    ]);
    if (cfgError) { if (requestId === loadRequestIdRef.current) throw cfgError; return; }
    if (submissionsError) { if (requestId === loadRequestIdRef.current) throw submissionsError; return; }
    if (requestId !== loadRequestIdRef.current) return;
    setRows((submissions || []).filter((r: any) => r.status === 'pending_review').reverse());
    setHistory((submissions || []).filter((r: any) => r.status !== 'pending_review'));
    if (cfg) {
      setBankName(cfg.bank_name || ''); setAccountNumber(cfg.account_number || '');
      setAccountHolder(cfg.account_holder || ''); setInstructions(cfg.instructions || '');
      setActive(!!cfg.is_active);
    }
    const ids = Array.from(new Set((submissions || []).map((r: any) => r.booking_id)));
    if (ids.length) {
      const { data, error: statusError } = await db.rpc('get_bank_transfer_booking_statuses', { p_booking_ids: ids });
      if (statusError) { if (requestId === loadRequestIdRef.current) throw statusError; return; }
      if (requestId !== loadRequestIdRef.current) return;
      const map: Record<string, string> = {};
      (data || []).forEach((b: any) => { map[b.id] = b.status; });
      setBookingStatus(map);
    } else setBookingStatus({});
  }, []);

  useEffect(() => { load().catch((e: any) => setError(e?.message || 'Gagal memuat data transfer bank.')); }, [load]);

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: rpcError } = await (supabase as any).rpc('admin_update_bank_transfer_settings', {
        p_is_active: active, p_bank_name: bankName.trim(), p_account_number: accountNumber.trim(),
        p_account_holder: accountHolder.trim(), p_instructions: instructions.trim(),
      });
      if (rpcError) throw rpcError;
      setMessage('Pengaturan rekening berhasil disimpan. Instruksi booking lama tetap memakai snapshot rekening sebelumnya.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan pengaturan rekening.');
    } finally {
      setBusy(false);
    }
  };

  const review = async () => {
    if (!dialog) return;
    if (!notes.trim()) { setError('Catatan pemeriksaan wajib diisi.'); return; }
    if (dialog.approve && !reference.trim()) { setError('Referensi transaksi bank wajib diisi.'); return; }
    setBusy(true); setError('');
    try {
      const { error: rpcError } = await (supabase as any).rpc('admin_review_bank_transfer_payment', {
        p_submission_id: dialog.row.id, p_approve: dialog.approve,
        p_admin_notes: notes.trim(), p_transfer_reference: dialog.approve ? reference.trim() : null,
      });
      if (rpcError) throw rpcError;
      setDialog(null); setNotes(''); setReference('');
      setMessage(dialog.approve ? 'Pembayaran disahkan dan masuk escrow.' : 'Bukti ditolak; Customer dapat mengirim bukti baru.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Gagal memproses verifikasi pembayaran.');
    } finally {
      setBusy(false);
    }
  };

  const actionable = rows.filter(r => bookingStatus[r.booking_id] === 'pending_payment');
  const stale = rows.filter(r => bookingStatus[r.booking_id] !== 'pending_payment');

  const ReviewCard: React.FC<{ row: any; inactive?: boolean }> = ({ row, inactive }) => {
    const [url, setUrl] = useState('');
    useEffect(() => { let alive = true; supabase.storage.from('bank-transfer-payment-proofs').createSignedUrl(row.proof_storage_path, 300).then(({ data }) => { if (alive) setUrl(data?.signedUrl || ''); }); return () => { alive = false; }; }, [row.proof_storage_path]);
    return <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>Booking: {row.booking_id}</strong><span className="inline-flex items-center gap-1 text-amber-700"><Clock className="h-3.5 w-3.5" /> Menunggu</span></div>
      <p>Nominal: <strong>{formatRupiah(Number(row.claimed_amount))}</strong></p>
      {row.transfer_reference && <p>Referensi Customer: {row.transfer_reference}</p>}
      {url && <a href={url} target="_blank" rel="noreferrer" className="inline-block text-purple-700 underline">Lihat bukti transfer</a>}
      {inactive ? <div className="space-y-2"><p className="rounded-lg bg-slate-100 p-2 text-slate-600">Booking tidak aktif ({bookingStatus[row.booking_id] || 'tidak diketahui'}); pembayaran tidak boleh disahkan.</p><button disabled={busy} onClick={() => { setDialog({ row, approve: false }); setNotes(''); setReference(''); }} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-50"><XCircle className="h-4 w-4" /> Tutup pengajuan / Tolak</button></div> :
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => { setDialog({ row, approve: true }); setNotes(''); setReference(''); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Setujui</button><button disabled={busy} onClick={() => { setDialog({ row, approve: false }); setNotes(''); setReference(''); }} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 font-bold text-white disabled:opacity-50"><XCircle className="h-4 w-4" /> Tolak</button></div>}
    </article>;
  };

  return <div className="space-y-5">
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div><h3 className="font-extrabold text-slate-900">Pengaturan Rekening Transfer Bank</h3><p className="text-xs text-slate-500">Hanya Super Admin atau Admin dengan izin Finance yang dapat mengubah rekening. Perubahan dicatat di audit log.</p></div>
      <label className="block text-xs font-bold">Nama Bank<input value={bankName} onChange={e => setBankName(e.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      <label className="block text-xs font-bold">Nomor Rekening<input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      <label className="block text-xs font-bold">Nama Pemilik Rekening<input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      <label className="block text-xs font-bold">Instruksi Pembayaran<textarea value={instructions} onChange={e => setInstructions(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Aktifkan transfer bank untuk Customer</label>
      <button type="button" onClick={save} disabled={busy || (active && (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()))} className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Rekening</button>
    </section>
    {message && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}
    {error && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
    <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-extrabold text-slate-900">Bukti Transfer Menunggu ({actionable.length})</h3><button onClick={() => load().catch((e: any) => setError(e.message))} className="inline-flex items-center gap-1 text-xs font-bold text-purple-700"><RefreshCw className="h-3.5 w-3.5" /> Muat ulang</button></div>
      {actionable.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">Belum ada bukti transfer yang menunggu pemeriksaan.</p>}
      {actionable.map(row => <ReviewCard key={row.id} row={row} />)}
    </section>
    {stale.length > 0 && <section className="space-y-3"><h3 className="font-extrabold text-slate-500">Booking tidak aktif ({stale.length})</h3>{stale.map(row => <ReviewCard key={row.id} row={row} inactive />)}</section>}
    <section className="space-y-3"><h3 className="font-extrabold text-slate-900">Riwayat Verifikasi Transfer Bank</h3>
      {history.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">Belum ada pembayaran transfer bank yang selesai diperiksa.</p>}
      {history.map(row => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>Booking: {row.booking_id}</strong><span className={row.status === 'approved' ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>{row.status === 'approved' ? 'Disetujui' : 'Ditolak'}</span></div>
        <p className="mt-1">Nominal: <strong>{formatRupiah(Number(row.claimed_amount))}</strong>{row.transfer_reference ? ` • Referensi: ${row.transfer_reference}` : ''}</p>
        {row.admin_notes && <p className="mt-1 text-slate-500">Catatan: {row.admin_notes}</p>}
        <p className="mt-1 text-[10px] text-slate-400">Diajukan: {new Date(row.created_at).toLocaleString('id-ID')}{row.reviewed_at ? ` • Diperiksa: ${new Date(row.reviewed_at).toLocaleString('id-ID')}` : ''}</p>
      </article>)}
    </section>
    {dialog && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => !busy && setDialog(null)}><div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
      <h4 className="font-extrabold text-slate-900">{dialog.approve ? 'Verifikasi Transfer Bank' : 'Tolak Bukti Transfer'}</h4>
      <p className="text-xs text-slate-500">Nominal: <strong>{formatRupiah(Number(dialog.row.claimed_amount))}</strong></p>
      <label className="block text-xs font-bold">{dialog.approve ? 'Catatan verifikasi' : 'Alasan penolakan'}<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      {dialog.approve && <label className="block text-xs font-bold">Referensi transaksi bank<input value={reference} onChange={e => setReference(e.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>}
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setDialog(null)} disabled={busy} className="rounded-lg border px-4 py-2 text-xs font-bold">Batal</button><button type="button" onClick={review} disabled={busy} className="rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Memproses...' : dialog.approve ? 'Setujui' : 'Tolak'}</button></div>
    </div></div>}
  </div>;
};
