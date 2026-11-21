import React, { useState } from 'react';
import { ExternalLink, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../utils/formatters';

type Props = { bookingId: string; amount: number; bookingStatus: string; paymentRoute?: string | null; onRouteClaimed?: (route: 'xendit') => void };

export const XenditCustomerPaymentPanel: React.FC<Props> = ({ bookingId, amount, bookingStatus, paymentRoute, onRouteClaimed }) => {
  const [busy, setBusy] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [error, setError] = useState('');

  if (bookingStatus !== 'pending_payment') return null;
  if (paymentRoute && paymentRoute !== 'xendit') return null;

  const startCheckout = async () => {
    setBusy(true); setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { booking_id: bookingId },
      });
      if (fnError) throw fnError;
      if (!data?.invoice_url) throw new Error('Invoice Xendit tidak tersedia.');
      setInvoiceUrl(data.invoice_url);
      onRouteClaimed?.('xendit');
    } catch (e: any) {
      setError(e?.message || 'Gagal membuat pembayaran Xendit.');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 space-y-4 rounded-[1.5rem] border border-white/80 bg-white/85 p-4 shadow-[0_18px_45px_-24px_rgba(76,29,149,0.35)] ring-1 ring-violet-100/80 backdrop-blur-xl sm:p-5">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-700"><CreditCard className="h-3.5 w-3.5" /> Pembayaran aman</div>\n        <h4 className="text-base font-extrabold tracking-tight text-slate-950">Pembayaran Xendit</h4>
        <p className="mt-1 text-xs text-slate-500">Bayar online melalui invoice Xendit sebesar {formatRupiah(amount)}.</p>
      </div>
      {invoiceUrl ? (
        <a href={invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-700 px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:shadow-xl">
          <ExternalLink className="h-4 w-4" /> Lanjutkan Pembayaran Xendit
        </a>
      ) : (
        <button type="button" onClick={startCheckout} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-700 px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {busy ? 'Menyiapkan Invoice...' : 'Bayar dengan Xendit'}
        </button>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-[10px] leading-relaxed text-amber-800">Setelah jalur Xendit dipilih, booking ini tidak dapat berpindah ke QRIS.</p>
    </div>
  );
};
