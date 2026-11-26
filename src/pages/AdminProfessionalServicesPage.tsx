import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, XCircle, Clock3, RefreshCw, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';
import { getProfessionalVerificationGuide } from '../lib/professionalServiceVerification';
import { formatProfessionalRate } from '../lib/professionalServicePricing';

interface ApplicationRow {
  id: string;
  applicant_id: string;
  subcategory_id: string;
  service_description: string;
  experience_years: number;
  service_city: string;
  delivery_modes: string[];
  rate_amount: number;
  pricing_unit: string;
  credential_document_path: string | null;
  supporting_document_path: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  subcategory: { title: string; verification_level: string; category: { title: string } };
  provider?: { display_name: string; avatar_url: string | null; city: string; is_approved: boolean };
  credential_url?: string | null;
  supporting_url?: string | null;
  credential_url_error?: boolean;
  supporting_url_error?: boolean;
}
interface StatusHistoryEntry {
  id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  admin_note: string | null;
  actor_role: 'applicant' | 'admin' | 'system';
  created_at: string;
}
interface Props { onNavigate: (path: AppRoute) => void; }
const statusLabels: Record<string, string> = { pending: 'Menunggu', under_review: 'Sedang diperiksa', needs_revision: 'Perlu revisi', approved: 'Disetujui', rejected: 'Ditolak' };

export const AdminProfessionalServicesPage: React.FC<Props> = ({ onNavigate }) => {
  const { role, adminAccess, isAuthLoading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [statusHistory, setStatusHistory] = useState<Record<string, StatusHistoryEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState('');
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('professional_service_applications')
      .select('id, applicant_id, subcategory_id, service_description, experience_years, service_city, delivery_modes, rate_amount, pricing_unit, credential_document_path, supporting_document_path, status, admin_note, created_at, subcategory:professional_service_subcategories!inner(title, verification_level, category:professional_service_categories!inner(title))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error: queryError, count } = await query;
    if (queryError) {
      setError('Data pengajuan belum dapat dimuat. Pastikan migrasi aplikasi profesional sudah diterapkan dan akses admin Talent tersedia.');
      setRows([]);
      setTotalRows(0);
      setLoading(false);
      return;
    }
    setTotalRows(count || 0);
    const appRows = (data || []) as any[];
    const applicationIds = appRows.map((row) => row.id);
    const { data: historyRows, error: historyError } = applicationIds.length
      ? await supabase.from('professional_service_application_status_history')
          .select('id,application_id,from_status,to_status,admin_note,actor_role,created_at')
          .in('application_id', applicationIds)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      : { data: [] as any[], error: null };
    if (historyError) setError('Antrean dimuat, tetapi riwayat perubahan status gagal dimuat. Periksa migrasi riwayat status dan izin baca.');
    setStatusHistory((historyRows || []).reduce((acc: Record<string, StatusHistoryEntry[]>, entry: StatusHistoryEntry) => {
      (acc[entry.application_id] ||= []).push(entry);
      return acc;
    }, {}));
    const ids = [...new Set(appRows.map((row) => row.applicant_id))];
    const { data: profiles, error: profileQueryError } = ids.length
      ? await supabase.from('talent_profiles').select('id,display_name,avatar_url,city,is_approved').in('id', ids)
      : { data: [] as any[], error: null };
    if (profileQueryError) {
      setError('Pengajuan berhasil dimuat, tetapi data profil Talent gagal dimuat. Periksa izin baca talent_profiles sebelum melakukan review.');
    }
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    const hydrated = await Promise.all(appRows.map(async (row) => {
      const subcategory = Array.isArray(row.subcategory) ? row.subcategory[0] : row.subcategory;
      const credential = row.credential_document_path
        ? await supabase.storage.from('professional-service-documents').createSignedUrl(row.credential_document_path, 300)
        : null;
      const supporting = row.supporting_document_path
        ? await supabase.storage.from('professional-service-documents').createSignedUrl(row.supporting_document_path, 300)
        : null;
      return {
        ...row,
        subcategory,
        provider: profileMap.get(row.applicant_id),
        credential_url: credential?.data?.signedUrl || null,
        supporting_url: supporting?.data?.signedUrl || null,
        credential_url_error: !!row.credential_document_path && !!credential?.error,
        supporting_url_error: !!row.supporting_document_path && !!supporting?.error,
      };
    }));
    setRows(hydrated as ApplicationRow[]);
    setLoading(false);
  }, [filter, page]);

  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(totalRows / PAGE_SIZE) - 1);
    if (!loading && page > lastPage) setPage(lastPage);
  }, [loading, page, totalRows]);

  useEffect(() => {
    if (isAuthLoading) return;
    const check = async () => {
      if (role !== 'admin' || !adminAccess) { setAuthorized(false); setLoading(false); return; }
      const canReview = adminAccess.isSuperAdmin || adminAccess.permissions.includes('talent');
      setAuthorized(canReview);
      if (canReview) await load();
      else setLoading(false);
    };
    void check();
  }, [role, adminAccess, isAuthLoading, load]);

  const review = async (id: string, decision: 'under_review' | 'approved' | 'rejected' | 'needs_revision') => {
    const application = rows.find((row) => row.id === id);
    if (decision === 'approved' && application) {
      const requiredCredentialMissing = ['credential', 'license'].includes(application.subcategory?.verification_level)
        && (!application.credential_document_path || !application.credential_url || application.credential_url_error);
      const attachedEvidenceUnavailable =
        (!!application.credential_document_path && (!application.credential_url || application.credential_url_error))
        || (!!application.supporting_document_path && (!application.supporting_url || application.supporting_url_error));
      if (requiredCredentialMissing || attachedEvidenceUnavailable) {
        setError('Persetujuan diblokir: dokumen yang diwajibkan atau dilampirkan belum dapat dibuka melalui tautan aman. Periksa akses Storage dan muat ulang antrean sebelum menyetujui.');
        return;
      }
    }
    setActingId(id);
    setError('');
    const { error: actionError } = await supabase.rpc('admin_review_professional_service_application', {
      p_application_id: id,
      p_decision: decision,
      p_admin_note: notes[id] || null,
      p_verification_note: verificationNotes[id] || null,
    });
    if (actionError) setError(actionError.message);
    else {
      setNotes((current) => ({ ...current, [id]: '' }));
      setVerificationNotes((current) => ({ ...current, [id]: '' }));
      await load();
    }
    setActingId(null);
  };

  if (isAuthLoading || authorized === null) return <div className="min-h-[50vh] p-8 text-center text-sm text-slate-500">Memeriksa akses admin...</div>;
  if (!authorized) return <div className="min-h-[60vh] bg-[#F8F7FC] px-4 py-12 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-rose-500"/><h1 className="mt-3 text-lg font-extrabold text-slate-900">Akses dibatasi</h1><p className="mt-2 text-xs text-slate-500">Halaman ini hanya untuk admin Talent atau Super Admin.</p><button onClick={() => onNavigate('/admin')} className="mt-5 rounded-xl bg-[#24105F] px-4 py-2.5 text-xs font-bold text-white">Kembali ke Admin</button></div>;

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-[#F8F7FC] pb-12">
      <header className="bg-gradient-to-br from-[#24105F] to-[#5416B8] px-4 py-6 text-white"><div className="mx-auto max-w-5xl">
        <button onClick={() => onNavigate('/admin')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-violet-100"><ArrowLeft className="h-4 w-4"/> Kembali ke Admin</button>
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">YUKU Admin · Talent</p><h1 className="mt-1 text-xl font-extrabold">Review Jasa Profesional</h1><p className="mt-2 text-xs text-violet-100">Periksa dokumen dan kelayakan layanan sebelum dipublikasikan.</p></div><button onClick={() => void load()} disabled={loading} className="rounded-xl bg-white/15 p-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button></div>
      </div></header>
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {['pending','under_review','needs_revision','approved','rejected','all'].map((value) => <button key={value} onClick={() => { setFilter(value); setPage(0); }} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold ${filter === value ? 'bg-[#24105F] text-white' : 'bg-slate-100 text-slate-600'}`}>{({pending:'Menunggu',under_review:'Diproses',needs_revision:'Perlu revisi',approved:'Disetujui',rejected:'Ditolak',all:'Semua'} as Record<string,string>)[value]}</button>)}
        </div>
        {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4"/>{error}</div>}
        {loading ? <div className="py-12 text-center text-xs text-slate-500">Memuat pengajuan...</div> : rows.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-800">Tidak ada pengajuan</p></div> : (
          <div className="mt-5 space-y-4">{rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">{row.provider?.avatar_url ? <img src={row.provider.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover"/> : <div className="h-12 w-12 rounded-xl bg-violet-50"/>}<div><p className="text-sm font-extrabold text-slate-900">{row.provider?.display_name || 'Talent tidak ditemukan'}</p><p className="mt-0.5 text-[10px] text-slate-500">{row.provider?.city || row.service_city} · {row.provider?.is_approved ? 'Profil Talent disetujui' : 'Profil Talent belum disetujui'}</p></div></div>
                <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-800">{({pending:'Menunggu',under_review:'Sedang diperiksa',needs_revision:'Perlu revisi',approved:'Disetujui',rejected:'Ditolak'} as Record<string,string>)[row.status] || row.status}</span>
              </div>
              <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">{row.subcategory?.category?.title}</p><h2 className="mt-1 text-base font-extrabold text-slate-900">{row.subcategory?.title}</h2><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{row.service_description}</p></div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">{row.experience_years} tahun pengalaman</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{row.service_city}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{row.delivery_modes.join(' / ')}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{formatProfessionalRate(row.rate_amount, row.pricing_unit)}</span></div>
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-950"><strong>Checklist verifikasi khusus {row.subcategory?.title}:</strong><ul className="mt-1 list-disc space-y-1 pl-4">{getProfessionalVerificationGuide(row.subcategory_id).reviewer.map((item, index) => <li key={index}>{item}</li>)}</ul><p className="mt-2 text-amber-800">Tier minimum: {row.subcategory?.verification_level}. Checklist ini panduan pemeriksaan; Admin tetap wajib memastikan aturan dan kewenangan yang berlaku.</p></div>
              <div className="mt-3 flex flex-wrap gap-2">{row.credential_url && <a href={row.credential_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-violet-700"><FileText className="h-3 w-3"/> Dokumen kompetensi <ExternalLink className="h-3 w-3"/></a>}{row.supporting_url && <a href={row.supporting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-violet-700"><FileText className="h-3 w-3"/> Dokumen pendukung <ExternalLink className="h-3 w-3"/></a>}{(row.credential_url_error || row.supporting_url_error) && <span role="alert" className="text-[10px] font-semibold text-rose-700">Lampiran tercatat, tetapi tautan aman gagal dibuat. Muat ulang atau periksa akses Storage sebelum mengambil keputusan.</span>}{!row.credential_document_path && !row.supporting_document_path && <span className="text-[10px] text-slate-500">Tidak ada dokumen lampiran.</span>}</div>
              <label className="mt-4 block text-[10px] font-bold text-slate-700">Catatan verifikasi internal (wajib saat menyetujui)<textarea rows={3} value={verificationNotes[row.id] || ''} onChange={(e) => setVerificationNotes((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={2000} placeholder="Catat apa yang diperiksa: identitas, penerbit dokumen, kecocokan nama, masa berlaku, ruang lingkup izin, atau referensi kerja. Minimal 20 karakter." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label>
              <label className="mt-3 block text-[10px] font-bold text-slate-700">Catatan untuk pemohon<textarea rows={2} value={notes[row.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={1000} placeholder="Alasan revisi atau informasi yang perlu diketahui pemohon..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label>
              {row.admin_note && <p className="mt-2 text-[10px] text-slate-500">Catatan sebelumnya: {row.admin_note}</p>}{statusHistory[row.id]?.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Riwayat status</p><ol className="space-y-3">{statusHistory[row.id].map((entry, index) => <li key={entry.id} className="relative pl-4"><span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${index === statusHistory[row.id].length - 1 ? 'bg-violet-600' : 'bg-slate-300'}`}/><p className="text-[10px] font-bold text-slate-800">{entry.from_status ? statusLabels[entry.from_status] + ' → ' : 'Pengajuan dibuat · '}{statusLabels[entry.to_status] || entry.to_status}</p><p className="mt-0.5 text-[10px] text-slate-500">{new Date(entry.created_at).toLocaleString('id-ID')} · {entry.actor_role === 'admin' ? 'Admin YUKU' : entry.actor_role === 'applicant' ? 'Talent' : 'Sistem'}</p>{entry.admin_note && <p className="mt-1 text-[10px] text-slate-600">Catatan: {entry.admin_note}</p>}</li>)}</ol></div>}
              {row.status !== 'approved' && row.status !== 'rejected' && <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!!actingId} onClick={() => void review(row.id,'under_review')} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 disabled:opacity-50"><Clock3 className="mr-1 inline h-3 w-3"/> Tandai diproses</button>
                <button disabled={!!actingId} onClick={() => void review(row.id,'needs_revision')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 disabled:opacity-50">Minta revisi</button>
                <button disabled={!!actingId || !row.provider?.is_approved || (verificationNotes[row.id] || '').trim().length < 20 || ((row.subcategory?.verification_level === 'license' || row.subcategory?.verification_level === 'credential') && (!row.credential_document_path || !row.credential_url || row.credential_url_error)) || (!!row.credential_document_path && (!row.credential_url || row.credential_url_error)) || (!!row.supporting_document_path && (!row.supporting_url || row.supporting_url_error))} onClick={() => void review(row.id,'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-3 w-3"/> Setujui & tampilkan</button>
                <button disabled={!!actingId} onClick={() => void review(row.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"><XCircle className="mr-1 inline h-3 w-3"/> Tolak</button>
              </div>}
              {actingId === row.id && <p className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin"/> Menyimpan keputusan...</p>}
            </article>
          ))}</div>
        )}
        {!loading && totalRows > 0 && <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] text-slate-500">Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalRows)} dari {totalRows} pengajuan</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 disabled:opacity-40">Sebelumnya</button>
            <span className="text-[10px] font-semibold text-slate-600">{page + 1}/{totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 disabled:opacity-40">Berikutnya</button>
          </div>
        </div>}
      </div>
    </main>
  );
};
