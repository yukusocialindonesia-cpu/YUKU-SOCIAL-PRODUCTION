import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, MailPlus, RefreshCw, Save, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type AdminPermission = 'talent' | 'booking' | 'finance' | 'support';
interface AdminAccountRow {
  user_id: string;
  email: string | null;
  admin_level: 'super_admin' | 'admin';
  is_active: boolean;
  permissions: AdminPermission[];
  created_at: string;
}

const permissionOptions: { key: AdminPermission; label: string; description: string }[] = [
  { key: 'talent', label: 'Talent', description: 'Profil Talent dan review layanan' },
  { key: 'booking', label: 'Booking', description: 'Daftar dan riwayat operasional booking' },
  { key: 'finance', label: 'Keuangan', description: 'Pencairan, refund, QRIS, dan affiliate' },
  { key: 'support', label: 'Support', description: 'Laporan insiden dan KTP Customer' },
];

export const AdminManagementPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<Record<string, AdminPermission[]>>({});
  const [email, setEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<AdminPermission[]>(['support']);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase.rpc('list_admin_accounts');
      if (loadError) throw loadError;
      const rows = (data || []) as AdminAccountRow[];
      setAccounts(rows);
      setDraftPermissions(Object.fromEntries(rows.map((row) => [row.user_id, row.permissions || []])));
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar Admin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const togglePermission = (current: AdminPermission[], permission: AdminPermission, checked: boolean): AdminPermission[] =>
    checked ? Array.from(new Set([...current, permission])) : current.filter((item) => item !== permission);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || invitePermissions.length === 0) {
      setError('Masukkan email dan pilih minimal satu izin menu.');
      return;
    }
    setInviting(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: inviteError } = await supabase.functions.invoke('admin-management', {
        body: { email: email.trim(), permissions: invitePermissions },
      });
      if (inviteError) throw inviteError;
      if (data?.error) throw new Error(data.error);
      setEmail('');
      setMessage('Undangan Admin berhasil dikirim. Admin baru dapat masuk setelah menerima undangan melalui email.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim undangan Admin.');
    } finally {
      setInviting(false);
    }
  };

  const handleSavePermissions = async (account: AdminAccountRow) => {
    setBusyId(account.user_id);
    setError(null);
    setMessage(null);
    try {
      const { error: saveError } = await supabase.rpc('set_admin_permissions', {
        p_admin_user_id: account.user_id,
        p_permissions: draftPermissions[account.user_id] || [],
      });
      if (saveError) throw saveError;
      setMessage('Izin menu untuk ' + (account.email || 'Admin') + ' berhasil diperbarui.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan izin Admin.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (account: AdminAccountRow) => {
    const nextActive = !account.is_active;
    const confirmed = window.confirm(
      nextActive
        ? 'Aktifkan kembali akun Admin ' + (account.email || '') + '?'
        : 'Nonaktifkan akun Admin ' + (account.email || '') + '? Akun ini tidak dapat membuka panel Admin sampai diaktifkan kembali.',
    );
    if (!confirmed) return;
    setBusyId(account.user_id);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await supabase.rpc('set_admin_active', {
        p_admin_user_id: account.user_id,
        p_is_active: nextActive,
      });
      if (updateError) throw updateError;
      setMessage(nextActive ? 'Akun Admin diaktifkan kembali.' : 'Akun Admin berhasil dinonaktifkan.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengubah status akun Admin.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MailPlus className="h-5 w-5 text-purple-700" />
          <div>
            <h3 className="font-extrabold text-slate-900">Undang Admin Baru</h3>
            <p className="text-xs text-slate-500">Undangan dikirim melalui email. Akun memakai halaman login YUKU yang sama.</p>
          </div>
        </div>
        <form onSubmit={handleInvite} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Email Admin</span>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@email.com" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-purple-500" />
          </label>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-700">Pilih izin menu</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissionOptions.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3">
                  <input type="checkbox" checked={invitePermissions.includes(option.key)}
                    onChange={(event) => setInvitePermissions((current) => togglePermission(current, option.key, event.target.checked))}
                    className="mt-0.5 accent-purple-700" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800">{option.label}</span>
                    <span className="block text-[11px] text-slate-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={inviting || invitePermissions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
            Kirim Undangan Admin
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900">Daftar Akun Admin</h3>
            <p className="text-xs text-slate-500">Atur beberapa izin sekaligus atau nonaktifkan akses Admin.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
            <RefreshCw className={'h-3.5 w-3.5' + (loading ? ' animate-spin' : '')} /> Segarkan
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat akun Admin...</div>
        ) : accounts.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">Belum ada akun Admin.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const current = draftPermissions[account.user_id] || [];
              const isSuper = account.admin_level === 'super_admin';
              return (
                <article key={account.user_id} className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-purple-700" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-slate-900">{account.email || 'Email tidak tersedia'}</p>
                        <p className="text-[11px] text-slate-500">{isSuper ? 'Super Admin' : 'Admin'}</p>
                      </div>
                    </div>
                    <span className={'rounded-full px-2.5 py-1 text-[10px] font-bold ' + (account.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>
                      {account.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  {isSuper ? (
                    <p className="text-xs text-slate-500">Akses penuh. Akun Super Admin tidak dapat diubah dari daftar ini.</p>
                  ) : (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {permissionOptions.map((option) => (
                          <label key={option.key} className={'flex items-start gap-2 rounded-lg border p-2.5 ' + (account.is_active ? 'cursor-pointer border-slate-200' : 'border-slate-100 opacity-60')}>
                            <input type="checkbox" disabled={!account.is_active || busyId === account.user_id}
                              checked={current.includes(option.key)}
                              onChange={(event) => setDraftPermissions((previous) => ({
                                ...previous,
                                [account.user_id]: togglePermission(current, option.key, event.target.checked),
                              }))}
                              className="mt-0.5 accent-purple-700" />
                            <span>
                              <span className="block text-xs font-bold text-slate-800">{option.label}</span>
                              <span className="block text-[11px] text-slate-500">{option.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void handleSavePermissions(account)}
                          disabled={!account.is_active || busyId === account.user_id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                          {busyId === account.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          Simpan Izin
                        </button>
                        <button onClick={() => void handleToggleActive(account)} disabled={busyId === account.user_id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                          {account.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          {account.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
