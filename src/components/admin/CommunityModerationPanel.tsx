import React, { useCallback, useEffect, useState } from 'react';
import { Flag, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  loadPendingCommunityReports,
  processCommunityReport,
  type CommunityReport,
} from '../../services/communityService';

const formatReportTime = (value: string) => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export const CommunityModerationPanel: React.FC = () => {
  const { adminAccess } = useAuth();
  const canModerate = adminAccess?.isSuperAdmin === true || adminAccess?.permissions.includes('support') === true;
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!canModerate) return;
    setLoading(true);
    setNotice('');
    try {
      setReports(await loadPendingCommunityReports());
    } catch (error) {
      console.error('YUKU: gagal memuat laporan komunitas', error);
      setNotice('Laporan belum dapat dimuat. Periksa izin Admin dan kesiapan database komunitas.');
    } finally {
      setLoading(false);
    }
  }, [canModerate]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleAction = async (report: CommunityReport, action: 'hide' | 'remove' | 'dismiss') => {
    if (busyId) return;
    if (action === 'remove' && !window.confirm('Keluarkan konten ini dari tampilan komunitas?')) return;
    setBusyId(report.id);
    setNotice('');
    try {
      await processCommunityReport(report.id, action,
        action === 'dismiss' ? 'Laporan ditinjau tanpa tindakan.' : 'Ditangani melalui panel Admin YUKU.');
      setNotice('Laporan berhasil diproses.');
      await refresh();
    } catch (error) {
      console.error('YUKU: gagal memproses laporan komunitas', error);
      setNotice('Tindakan belum berhasil. Coba lagi atau periksa izin moderasi.');
    } finally {
      setBusyId(null);
    }
  };

  if (!canModerate) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-purple-700">Keamanan Komunitas</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Moderasi Komunitas</h2>
          <p className="mt-1 text-xs text-slate-500">Tinjau laporan postingan dan komentar anggota YUKU.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex items-center gap-2 min-h-11 rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-800 hover:bg-purple-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Perbarui
        </button>
      </div>
      {notice && <p role="status" className="rounded-xl bg-purple-50 px-3 py-2 text-xs text-purple-800">{notice}</p>}
      {loading && reports.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Memuat laporan komunitas...</div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-white p-10 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 text-sm font-bold text-slate-800">Tidak ada laporan tertunda</p>
          <p className="mt-1 text-xs text-slate-500">Semua laporan komunitas sudah ditangani.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const target = report.community_posts || report.community_comments;
            const isPost = Boolean(report.post_id);
            return (
              <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-800">{report.reason}</span>
                  <span className="text-[10px] text-slate-400">{formatReportTime(report.created_at)}</span>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-800">{isPost ? 'Postingan' : 'Komentar'} · {target?.author_display_name || 'Anggota YUKU'}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{target?.body || 'Konten sudah tidak tersedia.'}</p>
                {report.details && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Catatan pelapor: {report.details}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={busyId !== null || !target} onClick={() => void handleAction(report, 'hide')}
                    className="min-h-11 rounded-lg bg-amber-100 px-3 py-2 text-[11px] font-bold text-amber-900 disabled:opacity-50">Sembunyikan</button>
                  <button type="button" disabled={busyId !== null || !target} onClick={() => void handleAction(report, 'remove')}
                    className="min-h-11 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">Keluarkan konten</button>
                  <button type="button" disabled={busyId !== null} onClick={() => void handleAction(report, 'dismiss')}
                    className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 disabled:opacity-50">Tolak laporan</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
        <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Tindakan moderasi hanya tersedia untuk Admin dengan izin Dukungan atau Super Admin.
      </div>
    </section>
  );
};
