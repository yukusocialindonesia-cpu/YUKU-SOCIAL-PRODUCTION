import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, XCircle, Clock3, RefreshCw, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';

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
}
interface Props { onNavigate: (path: AppRoute) => void; }
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const units: Record<string, string> = { per_hour: '/ jam', per_session: '/ sesi', per_day: '/ hari', per_project: '/ proyek' };

export const AdminProfessionalServicesPage: React.FC<Props> = ({ onNavigate }) => {
  const { role, adminAccess, isAuthLoading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('professional_service_applications')
      .select('id, applicant_id, subcategory_id, service_description, experience_years, service_city, delivery_modes, rate_amount, pricing_unit, credential_document_path, supporting_document_path, status, admin_note, created_at, subcategory:professional_service_subcategories!inner(title, verification_level, category:professional_service_categories!inner(title))')
      .order('created_at', { ascending: false })
      .limit(100);
    if (queryError) {
      setError('Data pengajuan belum dapat dimuat. Pastikan migrasi aplikasi profesional sudah diterapkan dan akses admin Talent tersedia.');
      setRows([]);
      setLoading(false);
      return;
    }
    const appRows = (data || []) as any[];
    const ids = [...new Set(appRows.map((row) => row.applicant_id))];
    const { data: profiles } = ids.length
      ? await supabase.from('talent_profiles').select('id,display_name,avatar_url,city,is_approved').in('id', ids)
      : { data: [] as any[] };
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
      };
    }));
    setRows(hydrated as ApplicationRow[]);
    setLoading(false);
  }, []);

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

  const filtered = rows.filter((row) => filter === 'all' || row.status === filter);

  return (
    <main className="min-h-screen bg-[#F8F7FC] pb-12">
      <header className="bg-gradient-to-br from-[#24105F] to-[#5416B8] px-4 py-6 text-white"><div className="mx-auto max-w-5xl">
        <button onClick={() => onNavigate('/admin')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-violet-100"><ArrowLeft className="h-4 w-4"/> Kembali ke Admin</button>
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">YUKU Admin · Talent</p><h1 className="mt-1 text-xl font-extrabold">Review Jasa Profesional</h1><p className="mt-2 text-xs text-violet-100">Periksa dokumen dan kelayakan layanan sebelum dipublikasikan.</p></div><button onClick={() => void load()} disabled={loading} className="rounded-xl bg-white/15 p-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button></div>
      </div></header>
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {['pending','under_review','needs_revision','approved','rejected','all'].map((value) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold ${filter === value ? 'bg-[#24105F] text-white' : 'bg-slate-100 text-slate-600'}`}>{({pending:'Menunggu',under_review:'Diproses',needs_revision:'Perlu revisi',approved:'Disetujui',rejected:'Ditolak',all:'Semua'} as Record<string,string>)[value]}</button>)}
        </div>
        {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4"/>{error}</div>}
        {loading ? <div className="py-12 text-center text-xs text-slate-500">Memuat pengajuan...</div> : filtered.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-800">Tidak ada pengajuan</p></div> : (
          <div className="mt-5 space-y-4">{filtered.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">{row.provider?.avatar_url ? <img src={row.provider.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover"/> : <div className="h-12 w-12 rounded-xl bg-violet-50"/>}<div><p className="text-sm font-extrabold text-slate-900">{row.provider?.display_name || 'Talent tidak ditemukan'}</p><p className="mt-0.5 text-[10px] text-slate-500">{row.provider?.city || row.service_city} · {row.provider?.is_approved ? 'Profil Talent disetujui' : 'Profil Talent belum disetujui'}</p></div></div>
                <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-800">{row.status}</span>
              </div>
              <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">{row.subcategory?.category?.title}</p><h2 className="mt-1 text-base font-extrabold text-slate-900">{row.subcategory?.title}</h2><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{row.service_description}</p></div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">{row.experience_years} tahun pengalaman</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{row.service_city}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{row.delivery_modes.join(' / ')}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{money(row.rate_amount)} {units[row.pricing_unit] || ''}</span></div>
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900"><strong>Standar verifikasi:</strong> {row.subcategory?.verification_level === 'license' ? 'Periksa lisensi/izin praktik yang masih berlaku, termasuk kesesuaian nama dan ruang lingkup profesi.' : row.subcategory?.verification_level === 'credential' ? 'Periksa sertifikat atau bukti kompetensi, penerbit, nama pemegang, dan masa berlaku.' : row.subcategory?.verification_level === 'reference' ? 'Lakukan pemeriksaan identitas dan referensi kerja.' : 'Lakukan pemeriksaan identitas.'}</div>
              <div className="mt-3 flex flex-wrap gap-2">{row.credential_url && <a href={row.credential_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-violet-700"><FileText className="h-3 w-3"/> Dokumen kompetensi <ExternalLink className="h-3 w-3"/></a>}{row.supporting_url && <a href={row.supporting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-violet-700"><FileText className="h-3 w-3"/> Dokumen pendukung <ExternalLink className="h-3 w-3"/></a>}{!row.credential_url && !row.supporting_url && <span className="text-[10px] text-slate-500">Tidak ada dokumen lampiran.</span>}</div>
              <label className="mt-4 block text-[10px] font-bold text-slate-700">Catatan verifikasi internal (wajib saat menyetujui)<textarea rows={3} value={verificationNotes[row.id] || ''} onChange={(e) => setVerificationNotes((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={2000} placeholder="Catat apa yang diperiksa: identitas, penerbit dokumen, kecocokan nama, masa berlaku, ruang lingkup izin, atau referensi kerja. Minimal 20 karakter." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label>
              <label className="mt-3 block text-[10px] font-bold text-slate-700">Catatan untuk pemohon<textarea rows={2} value={notes[row.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={1000} placeholder="Alasan revisi atau informasi yang perlu diketahui pemohon..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label>
              {row.admin_note && <p className="mt-2 text-[10px] text-slate-500">Catatan sebelumnya: {row.admin_note}</p>}
              {row.status !== 'approved' && row.status !== 'rejected' && <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!!actingId} onClick={() => void review(row.id,'under_review')} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 disabled:opacity-50"><Clock3 className="mr-1 inline h-3 w-3"/> Tandai diproses</button>
                <button disabled={!!actingId} onClick={() => void review(row.id,'needs_revision')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 disabled:opacity-50">Minta revisi</button>
                <button disabled={!!actingId || !row.provider?.is_approved || (verificationNotes[row.id] || '').trim().length < 20 || ((row.subcategory?.verification_level === 'license' || row.subcategory?.verification_level === 'credential') && !row.credential_document_path)} onClick={() => void review(row.id,'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-3 w-3"/> Setujui & tampilkan</button>
                <button disabled={!!actingId} onClick={() => void review(row.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"><XCircle className="mr-1 inline h-3 w-3"/> Tolak</button>
              </div>}
              {actingId === row.id && <p className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin"/> Menyimpan keputusan...</p>}
            </article>
          ))}</div>
        )}
      </div>
    </main>
  );
};
