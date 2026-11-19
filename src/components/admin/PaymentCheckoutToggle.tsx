import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, Unlock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Tombol Admin untuk membuka / menutup pembuatan booking berbayar (flag 'payment_checkout').
 * Membaca status lewat admin_get_payment_checkout_enabled() (migrasi 42) dan mengubahnya lewat
 * admin_set_payment_checkout_enabled(), yang juga mencatat log audit dan menolak pembukaan
 * jika QRIS belum aktif / belum punya gambar.
 */
export const PaymentCheckoutToggle: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [statusUnknown, setStatusUnknown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data, error: rpcError } = await (supabase as any).rpc('admin_get_payment_checkout_enabled');
    if (rpcError) {
      // Migrasi 42 belum dijalankan di database ini.
      setStatusUnknown(true);
      setEnabled(null);
      return;
    }
    setStatusUnknown(false);
    setEnabled(Boolean(data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const target = enabled === true ? false : true; // status yang akan dipasang

  const apply = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: rpcError } = await (supabase as any).rpc('admin_set_payment_checkout_enabled', {
        p_enabled: target,
        p_admin_notes: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setMessage(
        target
          ? 'Booking berbayar DIBUKA. Customer yang sudah terverifikasi kini bisa memesan.'
          : 'Booking berbayar DITUTUP. Booking yang sudah ada tidak terpengaruh.'
      );
      setConfirming(false);
      setNotes('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengubah status booking berbayar.');
    } finally {
      setBusy(false);
    }
  };

  const isOpen = enabled === true;

  return (
    <section
      aria-label="Status booking berbayar"
      className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
        isOpen ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
              isOpen ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {isOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900">
              Booking berbayar:{' '}
              {enabled === null ? (
                <span className="text-slate-500">status belum bisa dibaca</span>
              ) : isOpen ? (
                <span className="text-emerald-700">DIBUKA</span>
              ) : (
                <span className="text-amber-700">DITUTUP</span>
              )}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Saat ditutup, customer tidak bisa membuat booking baru. Booking yang sudah ada tidak terpengaruh.
              Pastikan QRIS aktif dan KTP customer percobaan sudah diverifikasi sebelum membuka.
            </p>
            {statusUnknown && (
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Status tidak terbaca karena migrasi 42 belum dijalankan di database ini. Tombol di bawah tetap bisa dipakai.
              </p>
            )}
          </div>
        </div>

        {!confirming && (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setError('');
              setMessage('');
            }}
            disabled={busy}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
              target ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {target ? 'Buka booking berbayar' : 'Tutup booking berbayar'}
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
          <p className="text-xs font-semibold text-slate-800">
            {target
              ? 'Yakin membuka booking berbayar untuk semua customer terverifikasi?'
              : 'Yakin menutup booking berbayar? Customer tidak bisa membuat booking baru.'}
          </p>
          <label className="block text-xs text-slate-700">
            <span className="font-semibold">Catatan (opsional, masuk log audit)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="Contoh: uji coba selesai, siap dibuka"
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {target ? 'Ya, buka' : 'Ya, tutup'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-xs font-semibold text-emerald-800">{message}</p>}
      {error && <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
    </section>
  );
};
