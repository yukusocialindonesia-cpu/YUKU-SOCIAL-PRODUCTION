import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../utils/formatters';

type Props = {
  bookingId: string;
  amount: number;
  bookingStatus: string;
  paymentRoute?: string | null;
  onRouteClaimed?: (route: 'manual_bank_transfer') => void;
  expiresAt?: string;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const BankTransferCustomerPaymentPanel: React.FC<Props> = ({
  bookingId, amount, bookingStatus, paymentRoute, onRouteClaimed, expiresAt,
}) => {
  const [now, setNow] = useState(Date.now());
  const [instructions, setInstructions] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [{ data: bankData, error: bankError }, { data: proofData, error: proofError }] = await Promise.all([
          (supabase as any).rpc('get_bank_transfer_instructions', { p_booking_id: bookingId }),
          (supabase as any).from('bank_transfer_submissions')
            .select('status,admin_notes,created_at')
            .eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (bankError) throw bankError;
        if (proofError) throw proofError;
        const bank = Array.isArray(bankData) ? bankData[0] : bankData;
        if (!bank) throw new Error('Instruksi rekening bank belum tersedia.');
        if (alive) {
          setInstructions(bank);
          setSubmission(proofData);
          onRouteClaimed?.('manual_bank_transfer');
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Gagal memuat instruksi transfer bank.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (bookingStatus === 'pending_payment' && (!paymentRoute || paymentRoute === 'manual_bank_transfer')) load();
    else setLoading(false);
    return () => { alive = false; };
  }, [bookingId, bookingStatus, paymentRoute, onRouteClaimed]);

  const left = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null;
  const countdown = left === null ? '' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

  const submit = async () => {
    if (!file) { setError('Pilih bukti transfer terlebih dahulu.'); return; }
    setBusy(true); setError(''); setSuccess('');
    let uploadedPath = '';
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('bank-transfer-payment-proofs')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      uploadedPath = path;
      const { error: rpcError } = await (supabase as any).rpc('submit_bank_transfer_payment_proof', {
        p_booking_id: bookingId, p_proof_storage_path: path, p_claimed_amount: amount,
        p_transfer_reference: reference.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSubmission({ status: 'pending_review', created_at: new Date().toISOString() });
      setFile(null); setReference('');
      setSuccess('Bukti transfer terkirim. Pembayaran menunggu verifikasi Admin.');
    } catch (e: any) {
      if (uploadedPath) await supabase.storage.from('bank-transfer-payment-proofs').remove([uploadedPath]);
      setError(e?.message || 'Gagal mengirim bukti transfer.');
    } finally { setBusy(false); }
  };

  if (bookingStatus !== 'pending_payment' || (paymentRoute && paymentRoute !== 'manual_bank_transfer')) return null;
  if (loading) return <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">Memuat instruksi transfer bank...</div>;
  if (error && !instructions) return <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="mr-1 inline h-4 w-4" />{error}</div>;
  if (submission?.status === 'pending_review') return <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900"><CheckCircle2 className="mr-1 inline h-4 w-4" />Bukti transfer sudah terkirim. Tunggu Admin memeriksa dana masuk; Anda tidak perlu mengirim ulang.</div>;
  if (submission?.status === 'approved') return <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><CheckCircle2 className="mr-1 inline h-4 w-4" />Pembayaran telah diverifikasi.</div>;

  return <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    {left !== null && <div className={`rounded-lg px-3 py-2 text-center text-xs font-bold ${left < 180 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>{left > 0 ? `Selesaikan pembayaran dalam ${countdown}` : 'Waktu pembayaran habis. Buat booking baru.'}</div>}
    <div><h4 className="text-sm font-extrabold text-slate-900">Transfer Bank YUKU</h4><p className="mt-1 text-xs text-slate-500">Transfer tepat sesuai nominal booking ke rekening berikut.</p></div>
    {instructions && <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs">
      <div><span className="text-slate-500">Bank</span><strong className="block text-sm text-slate-900">{instructions.bank_name}</strong></div>
      <div className="flex items-center justify-between gap-2"><div><span className="text-slate-500">Nomor rekening</span><strong className="block select-all text-lg tracking-wide text-slate-900">{instructions.account_number}</strong></div><button type="button" onClick={() => navigator.clipboard?.writeText(instructions.account_number)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 font-bold"><Copy className="h-3.5 w-3.5" /> Salin</button></div>
      <div><span className="text-slate-500">Atas nama</span><strong className="block text-sm text-slate-900">{instructions.account_holder}</strong></div>
      <div className="border-t border-slate-200 pt-2"><span className="text-slate-500">Total yang harus ditransfer</span><strong className="block text-2xl font-black text-purple-900">{formatRupiah(Number(instructions.gross_amount || amount))}</strong></div>
      {instructions.instructions && <p className="text-slate-600">{instructions.instructions}</p>}
      <p className="text-[10px] text-slate-500">Detail rekening ini dikunci untuk booking ini. Perubahan rekening oleh Admin tidak mengubah instruksi booking yang sedang berjalan.</p>
    </div>}
    {submission?.status === 'rejected' && <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><strong>Bukti perlu diperbaiki.</strong>{submission.admin_notes && <p className="mt-1">{submission.admin_notes}</p>}</div>}
    <label className="block text-xs font-bold text-slate-700">Bukti transfer (JPG/PNG/WebP/PDF, maks. 5 MB)
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-2 block w-full text-xs" onChange={e => { const selected = e.target.files?.[0] || null; setError(''); if (selected && (!ALLOWED_TYPES.includes(selected.type) || selected.size > MAX_PROOF_BYTES)) { setFile(null); setError('Format file tidak didukung atau ukuran melebihi 5 MB.'); } else setFile(selected); e.target.value = ''; }} />
    </label>
    {file && <p className="text-xs text-emerald-700">File dipilih: {file.name}</p>}
    <label className="block text-xs font-bold text-slate-700">Referensi transaksi (opsional)<input value={reference} onChange={e => setReference(e.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-200 p-2 font-normal" /></label>
    {error && <p className="text-xs text-rose-700">{error}</p>}{success && <p className="text-xs text-emerald-700">{success}</p>}
    <button type="button" onClick={submit} disabled={busy || !file} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? 'Mengirim...' : 'Kirim Bukti Transfer'}</button>
    <p className="text-[10px] text-slate-500">Unggahan tidak otomatis mengesahkan pembayaran. Admin akan mencocokkan dana masuk sebelum booking masuk escrow.</p>
  </section>;
};
