import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ManagedRole = 'customer' | 'talent';
type AccountStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';

interface ManagedAccount {
  id: string;
  email: string;
  full_name: string | null;
  role: ManagedRole;
  account_status: AccountStatus;
  created_at: string;
}

const statusLabels: Record<AccountStatus, string> = {
  pending_verification: 'Menunggu verifikasi',
  active: 'Aktif',
  suspended: 'Dinonaktifkan',
  banned: 'Diblokir',
};

export const AccountManagementPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('account-management', {
        body: { action: 'list' },
      });
      if (invokeError) throw invokeError;
      if (!data?.success || !Array.isArray(data.accounts)) throw new Error(data?.error || 'Daftar akun tidak dapat dimuat.');
      setAccounts(data.accounts as ManagedAccount[]);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar akun.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) =>
      [account.full_name, account.email, account.role, account.account_status]
        .some((value) => String(value || '').toLowerCase().includes(term)),
    );
  }, [accounts, search]);

  const changeStatus = async (account: ManagedAccount, nextStatus: 'active' | 'suspended') => {
    const actionLabel = nextStatus === 'suspended' ? 'menonaktifkan' : 'mengaktifkan kembali';
    const reason = window.prompt(`Alasan ${actionLabel} akun ${account.email}:`)?.trim();
    if (!reason) return;
    const confirmed = window.confirm(
      `Yakin ${actionLabel} akun ${account.email}? Login baru dan perpanjangan sesi akan diblokir. Access token yang sudah terbit tetap berlaku sampai kedaluwarsa. Tindakan ini akan dicatat di audit log.`,
    );
    if (!confirmed) return;

    setBusyId(account.id);
    setError(null);
    setMessage(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('account-management', {
        body: { action: 'set_status', userId: account.id, status: nextStatus, reason },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Status akun gagal diperbarui.');
      setMessage(data.message || 'Status akun berhasil diperbarui.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui status akun.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
          <div>
            <h3 className="text-sm font-black text-violet-950">Manajemen Akun Customer & Talent</h3>
            <p className="mt-1 text-xs leading-relaxed text-violet-900">
              Menu ini hanya tersedia untuk Super Admin. Menonaktifkan akun memblokir login baru dan perpanjangan sesi; sesi yang sedang aktif berakhir saat access token kedaluwarsa. Talent tidak lagi tampil di katalog.
              Riwayat transaksi tidak dihapus.
            </p>
          </div>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {message && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, telepon, role..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{filteredAccounts.length} akun ditampilkan dari maksimal 250 akun terbaru</span>
        <span>Customer & Talent</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat akun...</div>
      ) : filteredAccounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">Tidak ada akun yang cocok dengan pencarian.</div>
      ) : (
        <div className="space-y-2">
          {filteredAccounts.map((account) => (
            <article key={account.id} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-bold text-slate-900">{account.full_name || 'Tanpa nama'}</h4>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{account.role}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${account.account_status === 'active' ? 'bg-emerald-50 text-emerald-700' : account.account_status === 'suspended' || account.account_status === 'banned' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{statusLabels[account.account_status]}</span>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-600">{account.email}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Bergabung {new Date(account.created_at).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {account.account_status === 'active' || account.account_status === 'pending_verification' ? (
                    <button onClick={() => void changeStatus(account, 'suspended')} disabled={busyId !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 disabled:opacity-50">
                      {busyId === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />} Nonaktifkan
                    </button>
                  ) : account.account_status === 'suspended' ? (
                    <button onClick={() => void changeStatus(account, 'active')} disabled={busyId !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 disabled:opacity-50">
                      {busyId === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />} Aktifkan
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
        <strong>Penghapusan permanen belum diaktifkan.</strong> Sebelum anonimisasi, sistem harus memeriksa booking, pembayaran, payout, refund, sengketa, referral, audit, identitas KTP, dan file penyimpanan. Tahap ini sengaja ditahan agar data transaksi dan bukti hukum tidak terhapus.
      </div>
    </section>
  );
};
