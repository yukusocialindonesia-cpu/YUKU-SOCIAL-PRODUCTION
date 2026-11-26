import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Upload, ShieldCheck, Clock3, FileCheck2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';

interface Subcategory {
  id: string;
  title: string;
  description: string;
  verification_level: 'identity' | 'reference' | 'credential' | 'license';
  delivery_modes: string[];
  category_id: string;
  category_title: string;
}
interface Application {
  id: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  subcategory_id: string;
  service_description: string;
  experience_years: number;
  service_city: string;
  delivery_modes: string[];
  rate_amount: number;
  pricing_unit: string;
  credential_document_path: string | null;
  supporting_document_path: string | null;
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

const statusLabels: Record<string, string> = {
  pending: 'Menunggu pemeriksaan',
  under_review: 'Sedang diperiksa',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  needs_revision: 'Perlu perbaikan',
};
const verificationLabels: Record<string, string> = {
  identity: 'Pemeriksaan identitas',
  reference: 'Pemeriksaan identitas dan referensi',
  credential: 'Wajib dokumen kompetensi/sertifikat',
  license: 'Wajib izin atau lisensi profesi yang berlaku',
};
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const maxFileSize = 10 * 1024 * 1024;

export const ProfessionalServiceApplicationPage: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<{ id: string; title: string; items: Subcategory[] }[]>([]);
  const [hasTalentProfile, setHasTalentProfile] = useState<boolean | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusHistory, setStatusHistory] = useState<Record<string, StatusHistoryEntry[]>>({});
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [existingCredentialPath, setExistingCredentialPath] = useState<string | null>(null);
  const [existingSupportingPath, setExistingSupportingPath] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [experience, setExperience] = useState('0');
  const [city, setCity] = useState('');
  const [modes, setModes] = useState<string[]>(['offline']);
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState('per_session');
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedSubcategory = useMemo(
    () => categories.flatMap((category) => category.items).find((item) => item.id === subcategoryId),
    [categories, subcategoryId],
  );
  const requiresCredential = selectedSubcategory?.verification_level === 'credential' || selectedSubcategory?.verification_level === 'license';

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const [{ data: categoryRows, error: categoryError }, { data: applicationRows, error: applicationError }, { data: talentProfile, error: talentProfileError }, { data: historyRows, error: historyError }] = await Promise.all([
      supabase.from('professional_service_categories')
        .select('id,title,professional_service_subcategories(id,title,description,verification_level,delivery_modes,category_id)')
        .eq('is_active', true)
        .eq('professional_service_subcategories.is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('professional_service_applications')
        .select('id,status,admin_note,created_at,subcategory_id,service_description,experience_years,service_city,delivery_modes,rate_amount,pricing_unit,credential_document_path,supporting_document_path')
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('talent_profiles').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('professional_service_application_status_history')
        .select('id,application_id,from_status,to_status,admin_note,actor_role,created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
    ]);
    const normalized = (categoryRows || []).map((category: any) => ({
      id: category.id,
      title: category.title,
      items: (category.professional_service_subcategories || []).map((item: any) => ({
        ...item,
        category_title: category.title,
      })),
    }));
    setCategories(normalized);
    setApplications(applicationRows || []);
    setStatusHistory((historyRows || []).reduce((acc: Record<string, StatusHistoryEntry[]>, entry: StatusHistoryEntry) => {
      (acc[entry.application_id] ||= []).push(entry);
      return acc;
    }, {}));
    setHasTalentProfile(talentProfileError ? null : !!talentProfile);
    if (categoryError) setError('Daftar jenis jasa belum dapat dimuat. Coba muat ulang halaman atau hubungi admin YUKU.');
    else if (talentProfileError) setError('Status profil Talent belum dapat diperiksa. Silakan muat ulang halaman.');
    else if (applicationError) setError('Riwayat pengajuan belum dapat dimuat.');
    else if (historyError) setError('Riwayat perubahan status belum dapat dimuat. Coba muat ulang halaman.');
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const toggleMode = (mode: string) => setModes((current) =>
    current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode],
  );

  const validateFile = (file: File | null, label: string) => {
    if (!file) return '';
    if (!allowedTypes.includes(file.type)) return label + ' harus PDF, JPG, PNG, atau WebP.';
    if (file.size > maxFileSize) return label + ' maksimal 10 MB.';
    return '';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!user) { setError('Silakan masuk ke akun YUKU terlebih dahulu.'); return; }
    if (!selectedSubcategory) { setError('Pilih jenis jasa yang ingin ditawarkan.'); return; }
    if (description.trim().length < 30) { setError('Deskripsi layanan minimal 30 karakter.'); return; }
    if (!city.trim()) { setError('Isi kota atau area layanan.'); return; }
    if (!modes.length) { setError('Pilih minimal satu metode layanan.'); return; }
    if (!/^\d+$/.test(rate) || Number(rate) < 10000) { setError('Tarif minimal Rp10.000.'); return; }
    if (requiresCredential && !credentialFile && !existingCredentialPath) { setError('Jenis jasa ini wajib melampirkan sertifikat kompetensi atau izin profesi.'); return; }
    const fileError = validateFile(credentialFile, 'Dokumen kompetensi') || validateFile(supportingFile, 'Dokumen pendukung');
    if (fileError) { setError(fileError); return; }

    setSubmitting(true);
    const uploadedPaths: string[] = [];
    try {
      const uploadPrivate = async (file: File | null, label: string) => {
        if (!file) return null;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const path = `${user.id}/${crypto.randomUUID()}-${label}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('professional-service-documents')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw new Error('Gagal mengunggah ' + label + ': ' + uploadError.message);
        uploadedPaths.push(path);
        return path;
      };
      const credentialPath = credentialFile
        ? await uploadPrivate(credentialFile, 'credential')
        : existingCredentialPath;
      const supportingPath = supportingFile
        ? await uploadPrivate(supportingFile, 'supporting')
        : existingSupportingPath;
      const payload = {
        applicant_id: user.id,
        subcategory_id: subcategoryId,
        service_description: description.trim(),
        experience_years: Number(experience),
        service_city: city.trim(),
        delivery_modes: modes,
        rate_amount: Number(rate),
        pricing_unit: unit,
        credential_document_path: credentialPath,
        supporting_document_path: supportingPath,
        status: 'pending',
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
      };
      if (editingApplicationId) {
        const { data: updatedApplication, error: updateError } = await supabase
          .from('professional_service_applications')
          .update(payload)
          .eq('id', editingApplicationId)
          .eq('applicant_id', user.id)
          .eq('status', 'needs_revision')
          .select('id')
          .maybeSingle();
        if (updateError || !updatedApplication) {
          throw new Error('Pengajuan tidak berhasil diperbarui. Muat ulang riwayat dan coba lagi.');
        }
      } else {
        const { error: insertError } = await supabase
          .from('professional_service_applications')
          .insert(payload);
        if (insertError) throw new Error('Pengajuan belum tersimpan: ' + insertError.message);
      }
      if (editingApplicationId) {
        const replacedPaths = [
          credentialFile && existingCredentialPath ? existingCredentialPath : null,
          supportingFile && existingSupportingPath ? existingSupportingPath : null,
        ].filter(Boolean) as string[];
        if (replacedPaths.length) await supabase.storage.from('professional-service-documents').remove(replacedPaths);
      }
      setSuccess(editingApplicationId
        ? 'Perbaikan berhasil dikirim ulang. Pengajuan kembali masuk antrean pemeriksaan.'
        : 'Pengajuan berhasil dikirim. Tim YUKU akan memeriksa data dan dokumen sebelum layanan dapat ditampilkan.');
      setSubcategoryId('');
      setDescription('');
      setExperience('0');
      setCity('');
      setModes(['offline']);
      setRate('');
      setCredentialFile(null);
      setSupportingFile(null);
      setEditingApplicationId(null);
      setExistingCredentialPath(null);
      setExistingSupportingPath(null);
      await load();
    } catch (err) {
      if (uploadedPaths.length) {
        await supabase.storage.from('professional-service-documents').remove(uploadedPaths);
      }
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengirim pengajuan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return (
    <main className="min-h-[70vh] bg-[#F8F7FC] px-4 py-10">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center">
        <ShieldCheck className="mx-auto h-9 w-9 text-violet-700"/>
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">Masuk untuk mendaftar</h1>
        <p className="mt-2 text-sm text-slate-500">Pengajuan jasa profesional hanya tersedia untuk pengguna yang sudah masuk ke YUKU.</p>
        <button onClick={() => onNavigate('/login')} className="mt-5 rounded-xl bg-[#24105F] px-5 py-3 text-xs font-bold text-white">Masuk ke akun</button>
      </section>
    </main>
  );

  if (hasTalentProfile === false) return (
    <main className="min-h-[70vh] bg-[#F8F7FC] px-4 py-10">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center">
        <BriefcaseBusiness className="mx-auto h-9 w-9 text-violet-700"/>
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">Buat profil Talent terlebih dahulu</h1>
        <p className="mt-2 text-sm text-slate-500">Jasa profesional di YUKU ditawarkan melalui profil Talent. Daftarkan profil Talent Anda terlebih dahulu, lalu kembali untuk mengajukan layanan profesional.</p>
        <button onClick={() => onNavigate('/daftar-talent')} className="mt-5 rounded-xl bg-[#24105F] px-5 py-3 text-xs font-bold text-white">Daftar sebagai Talent</button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#F8F7FC] pb-12">
      <header className="bg-gradient-to-br from-[#24105F] to-[#5416B8] px-4 py-6 text-white">
        <div className="mx-auto max-w-3xl">
          <button onClick={() => onNavigate('/jasa-profesional')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-violet-100"><ArrowLeft className="h-4 w-4"/> Kembali</button>
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><BriefcaseBusiness className="h-5 w-5"/></span><div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">YUKU Professional Services</p><h1 className="text-xl font-extrabold">Daftarkan jasa profesional</h1></div></div>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-violet-100">Lengkapi keahlian, tarif, dan dokumen pendukung. Semua pengajuan diperiksa sebelum profil dan layanan dipublikasikan.</p>
        </div>
      </header>

      <div className="mx-auto mt-5 max-w-3xl space-y-4 px-4">
        {success && <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900"><CheckCircle2 className="h-4 w-4 shrink-0"/>{success}</div>}
        {error && <div className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <section><h2 className="text-sm font-extrabold text-slate-900">{editingApplicationId ? 'Perbaiki pengajuan layanan' : 'Informasi layanan'}</h2><p className="mt-1 text-[11px] text-slate-500">Pilih satu jenis jasa per pengajuan.</p></section>
          <label className="block text-xs font-bold text-slate-700">Jenis jasa
            <select value={subcategoryId} disabled={!!editingApplicationId} onChange={(e) => { const nextId = e.target.value; setSubcategoryId(nextId); const nextItem = categories.flatMap((category) => category.items).find((item) => item.id === nextId); setModes(nextItem?.delivery_modes || ['offline']); }} required className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Pilih jenis jasa</option>
              {categories.map((category) => <optgroup key={category.id} label={category.title}>{category.items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>)}
            </select>
          </label>
          {editingApplicationId && <p className="-mt-2 text-[10px] text-slate-500">Jenis jasa dikunci selama revisi. Untuk menawarkan jenis jasa lain, buat pengajuan baru setelah pengajuan ini selesai.</p>}
          {selectedSubcategory && <div className="rounded-xl bg-violet-50 p-3 text-[11px] leading-relaxed text-violet-900"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>{verificationLabels[selectedSubcategory.verification_level]}</div>}
          <label className="block text-xs font-bold text-slate-700">Deskripsi layanan
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={3000} required placeholder="Jelaskan keahlian, cakupan pekerjaan, dan layanan yang diberikan (minimal 30 karakter)." className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-violet-500"/>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">Pengalaman (tahun)<input type="number" min="0" max="80" value={experience} onChange={(e) => setExperience(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-xs"/></label>
            <label className="block text-xs font-bold text-slate-700">Kota/area layanan<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} required placeholder="Contoh: Bogor" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-xs"/></label>
          </div>
          <fieldset><legend className="text-xs font-bold text-slate-700">Metode layanan</legend><div className="mt-2 flex gap-2">{(selectedSubcategory?.delivery_modes || ['offline']).map((mode) => <label key={mode} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${modes.includes(mode) ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" checked={modes.includes(mode)} onChange={() => toggleMode(mode)}/>{mode === 'offline' ? 'Offline' : 'Online'}</label>)}</div></fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">Tarif (Rp)<input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g,''))} required placeholder="Contoh: 150000" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-xs"/></label>
            <label className="block text-xs font-bold text-slate-700">Satuan tarif<select value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="per_hour">Per jam</option><option value="per_session">Per sesi</option><option value="per_day">Per hari</option><option value="per_project">Per proyek</option></select></label>
          </div>

          <section className="border-t border-slate-100 pt-4"><h2 className="text-sm font-extrabold text-slate-900">Dokumen verifikasi</h2><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Dokumen disimpan di penyimpanan privat dan hanya dapat diakses pemilik akun serta admin yang berwenang. Maksimal 10 MB per file (PDF/JPG/PNG/WebP).</p></section>
          <label className="block rounded-xl border border-dashed border-violet-300 bg-violet-50/50 p-4 text-xs text-slate-700"><span className="flex items-center gap-2 font-bold"><Upload className="h-4 w-4 text-violet-700"/> Sertifikat/izin profesi {requiresCredential ? '(wajib)' : '(opsional)'}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required={!!requiresCredential} onChange={(e) => setCredentialFile(e.target.files?.[0] || null)} className="mt-3 block w-full text-[11px]"/>{credentialFile ? <span className="mt-2 block text-[10px] text-emerald-700">{credentialFile.name}</span> : existingCredentialPath && <span className="mt-2 block text-[10px] text-emerald-700">Dokumen sebelumnya tersimpan — unggah file baru jika ingin menggantinya.</span>}</label>
          <label className="block rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-700"><span className="flex items-center gap-2 font-bold"><FileCheck2 className="h-4 w-4 text-violet-700"/> Dokumen pendukung/referensi (opsional)</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setSupportingFile(e.target.files?.[0] || null)} className="mt-3 block w-full text-[11px]"/>{supportingFile ? <span className="mt-2 block text-[10px] text-emerald-700">{supportingFile.name}</span> : existingSupportingPath && <span className="mt-2 block text-[10px] text-emerald-700">Dokumen sebelumnya tersimpan — unggah file baru jika ingin menggantinya.</span>}</label>
          <div className="rounded-xl bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900"><strong>Catatan:</strong> Perawat, tenaga kesehatan, dan profesi berizin wajib memenuhi ketentuan sertifikat serta izin praktik yang berlaku. Pengajuan yang disetujui belum otomatis membuka pemesanan.</div>
          <button disabled={submitting || loading} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#24105F] text-xs font-extrabold text-white disabled:opacity-50">{submitting ? <><Loader2 className="h-4 w-4 animate-spin"/> Mengirim pengajuan...</> : editingApplicationId ? 'Kirim ulang setelah perbaikan' : 'Kirim pengajuan untuk diperiksa'}</button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-extrabold text-slate-900">Riwayat pengajuan</h2>
          {loading ? <p className="mt-3 text-xs text-slate-500">Memuat riwayat...</p> : applications.length === 0 ? <p className="mt-3 text-xs text-slate-500">Belum ada pengajuan.</p> : <div className="mt-3 space-y-2">{applications.map((item) => <article key={item.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-800">{statusLabels[item.status] || item.status}</span><span className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleDateString('id-ID')}</span></div><p className="mt-1 text-[11px] text-slate-600">{categories.flatMap((category) => category.items).find((itemCategory) => itemCategory.id === item.subcategory_id)?.title || 'Jasa profesional'}</p>{item.admin_note && <p className="mt-2 text-[11px] text-slate-600">Catatan admin: {item.admin_note}</p>}{statusHistory[item.id]?.length > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Perjalanan pengajuan</p><ol className="space-y-3">{statusHistory[item.id].map((entry, index) => <li key={entry.id} className="relative pl-4"><span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${index === statusHistory[item.id].length - 1 ? 'bg-violet-600' : 'bg-slate-300'}`}/><p className="text-[11px] font-bold text-slate-800">{entry.from_status ? (statusLabels[entry.from_status] || entry.from_status) + ' → ' : 'Pengajuan dibuat · '}{statusLabels[entry.to_status] || entry.to_status}</p><p className="mt-0.5 text-[10px] text-slate-500">{new Date(entry.created_at).toLocaleString('id-ID')} · {entry.actor_role === 'admin' ? 'Admin YUKU' : entry.actor_role === 'applicant' ? 'Talent' : 'Sistem'}</p>{entry.admin_note && <p className="mt-1 text-[10px] leading-relaxed text-slate-600">Catatan: {entry.admin_note}</p>}</li>)}</ol></div>}{item.status === 'needs_revision' && <button type="button" onClick={() => { setEditingApplicationId(item.id); setSubcategoryId(item.subcategory_id); setDescription(item.service_description); setExperience(String(item.experience_years)); setCity(item.service_city); setModes(item.delivery_modes || ['offline']); setRate(String(item.rate_amount)); setUnit(item.pricing_unit); setExistingCredentialPath(item.credential_document_path); setExistingSupportingPath(item.supporting_document_path); setCredentialFile(null); setSupportingFile(null); setError(''); setSuccess(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-3 rounded-lg bg-violet-100 px-3 py-2 text-[10px] font-bold text-violet-800">Perbaiki & kirim ulang</button>}</article>)}</div>}
        </section>
        <p className="flex items-center gap-2 px-1 text-[10px] text-slate-500"><Clock3 className="h-3.5 w-3.5"/> Proses pemeriksaan memerlukan waktu. Layanan belum ditampilkan selama status belum disetujui.</p>
      </div>
    </main>
  );
};
