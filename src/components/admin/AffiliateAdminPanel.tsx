import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Save, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../utils/formatters';

interface AffiliateSettings {
  commission_percent: number;
  is_enabled: boolean;
  updated_at: string;
}

export const AffiliateAdminPanel: React.FC = () => {
  const loadRequestIdRef = useRef(0);
  const [settings, setSettings] = useState<AffiliateSettings>({
    commission_percent: 10,
    is_enabled: true,
    updated_at: '',
  });
  const [percentInput, setPercentInput] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const { data, error: loadError } = await (supabase as any)
        .from('affiliate_settings')
        .select('commission_percent, is_enabled, updated_at')
        .eq('id', true)
        .single();
      if (loadError) throw loadError;
      if (requestId !== loadRequestIdRef.current) return;
      const next = {
        commission_percent: Number(data.commission_percent),
        is_enabled: Boolean(data.is_enabled),
        updated_at: data.updated_at,
      };
      setSettings(next);
      setPercentInput(String(next.commission_percent));
    } catch (e: any) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(e?.message || 'Pengaturan Affiliate gagal dimuat.');
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const percent = Number(percentInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError('Persentase harus antara 0 sampai 100.');
      setMessage('');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error: saveError } = await (supabase as any)
        .from('affiliate_settings')
        .update({
          commission_percent: percent,
          updated_at: new Date().toISOString(),
          updated_by: auth.user?.id ?? null,
        })
        .eq('id', true)
        .select('commission_percent, is_enabled, updated_at')
        .single();
      if (saveError) throw saveError;
      const next = {
        commission_percent: Number(data.commission_percent),
        is_enabled: Boolean(data.is_enabled),
        updated_at: data.updated_at,
      };
      setSettings(next);
      setPercentInput(String(next.commission_percent));
      setMessage('Persentase komisi Affiliate berhasil disimpan. Tarif baru berlaku untuk transaksi berikutnya.');
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan pengaturan Affiliate.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error: saveError } = await (supabase as any)
        .from('affiliate_settings')
        .update({
          is_enabled: !settings.is_enabled,
          updated_at: new Date().toISOString(),
          updated_by: auth.user?.id ?? null,
        })
        .eq('id', true)
        .select('commission_percent, is_enabled, updated_at')
        .single();
      if (saveError) throw saveError;
      const next = {
        commission_percent: Number(data.commission_percent),
        is_enabled: Boolean(data.is_enabled),
        updated_at: data.updated_at,
      };
      setSettings(next);
      setPercentInput(String(next.commission_percent));
      setMessage(next.is_enabled ? 'Program Affiliate diaktifkan.' : 'Program Affiliate dinonaktifkan. Tidak ada komisi baru yang dibuat.');
    } catch (e: any) {
      setError(e?.message || 'Gagal mengubah status Affiliate.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memuat pengaturan Affiliate...</div>;
  }

  const exampleGross = 200000;
  const examplePlatformFee = Math.round(exampleGross * 0.2);
  const exampleReward = Math.round(examplePlatformFee * (Number(percentInput) || 0) / 100);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><TrendingUp className="h-5 w-5" /></div>
          <div>
            <h3 className="font-extrabold text-slate-900">Pengaturan Affiliate Talent</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Talent mendapatkan komisi ketika Talent yang dia undang menyelesaikan transaksi yang valid. Berlaku satu tingkat, untuk transaksi berulang juga.</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-slate-800">Program Affiliate</span>
            <span className={settings.is_enabled ? 'text-xs font-bold text-emerald-700' : 'text-xs font-bold text-slate-500'}>{settings.is_enabled ? 'Aktif' : 'Nonaktif'}</span>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={toggleEnabled}
            className={`rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 ${settings.is_enabled ? 'border border-rose-200 bg-white text-rose-700' : 'bg-emerald-700 text-white'}`}
          >
            {settings.is_enabled ? 'Nonaktifkan Affiliate' : 'Aktifkan Affiliate'}
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="affiliate-commission-percent" className="block text-sm font-bold text-slate-800">Komisi Affiliate (% dari komisi platform YUKU)</label>
          <div className="flex items-center gap-2">
            <input
              id="affiliate-commission-percent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              inputMode="decimal"
              value={percentInput}
              onChange={(e) => setPercentInput(e.target.value)}
              className="w-32 rounded-xl border border-slate-300 px-3 py-3 text-lg font-extrabold text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />
            <span className="text-lg font-bold text-slate-600">%</span>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Masukkan angka 0–100. Contoh: 10 berarti Affiliate menerima 10% dari bagian komisi platform YUKU, bukan 10% dari seluruh harga booking.</p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-1">
          <p className="text-xs font-bold text-emerald-900">Contoh simulasi</p>
          <div className="flex justify-between gap-3 text-xs text-slate-700"><span>Nilai transaksi</span><b>{formatRupiah(exampleGross)}</b></div>
          <div className="flex justify-between gap-3 text-xs text-slate-700"><span>Komisi platform (20%)</span><b>{formatRupiah(examplePlatformFee)}</b></div>
          <div className="flex justify-between gap-3 text-xs text-emerald-800"><span>Bagian Affiliate ({Number(percentInput) || 0}%)</span><b>{formatRupiah(exampleReward)}</b></div>
          <p className="pt-1 text-[10px] text-slate-500">Simulasi mengikuti persentase yang sedang diketik. Nilai aktual dihitung otomatis oleh database saat pembayaran transaksi baru berhasil.</p>
        </div>

        {settings.updated_at && <p className="text-[10px] text-slate-400">Terakhir diperbarui: {new Date(settings.updated_at).toLocaleString('id-ID')}</p>}
        {message && <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}
        {error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 break-words">{error}</p>}
      </section>
    </div>
  );
};
