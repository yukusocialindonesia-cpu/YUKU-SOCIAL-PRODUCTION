import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, MapPin, Plus, Send, Store, CheckCircle2, Clock3, AlertCircle, Loader2, Users, UserPlus, UserMinus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';

interface Props { onNavigate: (path: AppRoute) => void; }
interface MerchantBusiness {
  id: string;
  business_name: string;
  description: string | null;
  business_category: string | null;
  public_phone: string | null;
  website_url: string | null;
  review_status: 'draft' | 'pending_review' | 'needs_revision' | 'approved' | 'rejected' | 'suspended';
}
interface MerchantLocation {
  id: string;
  business_id: string;
  location_name: string;
  address_text: string;
  city: string | null;
  province: string | null;
  is_active: boolean;
}
interface MerchantMember {
  membership_id: string;
  email: string | null;
  member_role: 'owner' | 'manager' | 'staff';
  membership_status: 'pending_invitation' | 'active' | 'suspended' | 'revoked';
  invited_at: string | null;
  accepted_at: string | null;
}

const statusCopy: Record<MerchantBusiness['review_status'], string> = {
  draft: 'Lengkapi profil dan lokasi, lalu ajukan verifikasi',
  pending_review: 'Menunggu pemeriksaan tim YUKU',
  needs_revision: 'Ada data yang perlu diperbaiki',
  approved: 'Bisnis disetujui',
  rejected: 'Pengajuan belum disetujui',
  suspended: 'Profil bisnis sedang dinonaktifkan',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

export const MerchantCenterPage: React.FC<Props> = ({ onNavigate }) => {
  const { user, accessSnapshot, refreshRole } = useAuth();
  const [businesses, setBusinesses] = useState<MerchantBusiness[]>([]);
  const [locations, setLocations] = useState<MerchantLocation[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [locationName, setLocationName] = useState('Lokasi utama');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [locationPhone, setLocationPhone] = useState('');
  const [teamMembers, setTeamMembers] = useState<MerchantMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [pendingInvitationIds, setPendingInvitationIds] = useState<Record<string,string>>({});

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) || businesses[0] || null,
    [businesses, activeBusinessId],
  );
  const memberships = accessSnapshot?.capabilities.merchantMemberships || [];
  const activeMembership = memberships.find((membership) => membership.businessId === activeBusiness?.id);
  const isOwner = activeMembership?.role === 'owner' && activeMembership.status === 'active';
  const canEdit = isOwner && (activeBusiness?.review_status === 'draft' || activeBusiness?.review_status === 'needs_revision');
  const canManageLocations = activeMembership?.status === 'active' && (
    (['draft', 'needs_revision'].includes(activeBusiness?.review_status || '') && ['owner', 'manager'].includes(activeMembership.role)) ||
    (activeBusiness?.review_status === 'approved' && isOwner)
  );
  const canSubmitForReview = isOwner && (activeBusiness?.review_status === 'draft' || activeBusiness?.review_status === 'needs_revision');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const { data: ownMemberships, error: membershipError } = await supabase
      .from('merchant_memberships')
      .select('id,business_id,membership_status')
      .eq('user_id', user.id)
      .in('membership_status', ['active','pending_invitation']);
    if (membershipError) {
      setError('Fitur Merchant Partner belum tersedia di server. Migrasi Merchant Partner perlu diterapkan dan diuji di staging terlebih dahulu.');
      setBusinesses([]);
      setLocations([]);
      setLoading(false);
      return;
    }
    const membershipRows = (ownMemberships || []) as { id: string; business_id: string; membership_status: string }[];
    const businessIds = [...new Set(membershipRows.map((membership) => membership.business_id))];
    setPendingInvitationIds(Object.fromEntries(membershipRows.filter((membership) => membership.membership_status === 'pending_invitation').map((membership) => [membership.business_id,membership.id])));
    const { data, error: queryError } = businessIds.length
      ? await supabase.from('merchant_businesses')
          .select('id,business_name,description,business_category,public_phone,website_url,review_status')
          .in('id', businessIds)
          .order('created_at', { ascending: false })
      : { data: [] as any[], error: null };
    if (queryError) {
      setError('Profil bisnis milik akun ini belum dapat dimuat.');
      setBusinesses([]);
      setLocations([]);
      setLoading(false);
      return;
    }
    const rows = (data || []) as MerchantBusiness[];
    setBusinesses(rows);
    const nextId = rows.some((row) => row.id === activeBusinessId) ? activeBusinessId : rows[0]?.id || '';
    setActiveBusinessId(nextId);
    if (nextId) {
      const { data: locationRows, error: locationError } = await supabase
        .from('merchant_locations')
        .select('id,business_id,location_name,address_text,city,province,is_active')
        .eq('business_id', nextId)
        .order('created_at', { ascending: true });
      if (locationError) setError('Profil bisnis terbaca, tetapi daftar lokasi belum dapat dimuat.');
      setLocations((locationRows || []) as MerchantLocation[]);
    } else {
      setLocations([]);
    }
    setLoading(false);
  }, [user, activeBusinessId]);

  useEffect(() => { void load(); }, [load]);

  const loadTeam = useCallback(async () => {
    if (!activeBusiness || !['owner','manager'].includes(activeMembership?.role || '') || activeMembership?.status !== 'active') {
      setTeamMembers([]);
      return;
    }
    setTeamLoading(true);
    const { data, error: teamError } = await supabase.rpc('get_merchant_business_members', {
      p_business_id: activeBusiness.id,
    });
    if (teamError) {
      setError('Daftar anggota belum tersedia. Pastikan migrasi pengelolaan anggota sudah diterapkan di staging.');
      setTeamMembers([]);
    } else {
      setTeamMembers((data || []) as MerchantMember[]);
    }
    setTeamLoading(false);
  }, [activeBusiness?.id, activeMembership?.role, activeMembership?.status]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  useEffect(() => {
    if (!activeBusiness) return;
    setBusinessName(activeBusiness.business_name);
    setDescription(activeBusiness.description || '');
    setCategory(activeBusiness.business_category || '');
    setPhone(activeBusiness.public_phone || '');
    setWebsite(activeBusiness.website_url || '');
  }, [activeBusiness?.id, activeBusiness?.business_name, activeBusiness?.description, activeBusiness?.business_category, activeBusiness?.public_phone, activeBusiness?.website_url]);

  const runAction = async (action: () => Promise<{ error: { message: string } | null }>, done: string) => {
    setSaving(true); setError(''); setSuccess('');
    const result = await action();
    if (result.error) setError(result.error.message || 'Aksi belum berhasil. Coba lagi.');
    else { setSuccess(done); await refreshRole(); await load(); }
    setSaving(false);
  };

  const createBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessName.trim()) { setError('Nama bisnis wajib diisi.'); return; }
    setSaving(true); setError(''); setSuccess('');
    const { data, error: rpcError } = await supabase.rpc('create_merchant_business', {
      p_business_name: businessName.trim(),
      p_description: description || null,
      p_business_category: category || null,
      p_public_phone: phone || null,
      p_website_url: website || null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setActiveBusinessId(String(data));
      setSuccess('Profil bisnis berhasil dibuat sebagai draft. Tambahkan lokasi usaha sebelum mengajukan verifikasi.');
      await refreshRole();
      await load();
    }
    setSaving(false);
  };

  const saveBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness) return;
    await runAction(async () => {
      const { error: rpcError } = await supabase.rpc('update_merchant_business_profile', {
        p_business_id: activeBusiness.id,
        p_business_name: businessName.trim(),
        p_description: description || null,
        p_business_category: category || null,
        p_public_phone: phone || null,
        p_website_url: website || null,
      });
      return { error: rpcError };
    }, 'Profil bisnis disimpan.');
  };

  const addLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness) return;
    if (!locationName.trim() || !address.trim()) { setError('Nama lokasi dan alamat wajib diisi.'); return; }
    setSaving(true); setError(''); setSuccess('');
    const { error: rpcError } = await supabase.rpc('add_merchant_location', {
      p_business_id: activeBusiness.id,
      p_location_name: locationName.trim(),
      p_address_text: address.trim(),
      p_city: city || null,
      p_province: province || null,
      p_public_phone: locationPhone || null,
      p_opening_hours: {},
    });
    if (rpcError) setError(rpcError.message);
    else {
      setAddress(''); setSuccess('Lokasi usaha berhasil ditambahkan.');
      await load();
    }
    setSaving(false);
  };

  const submitForReview = async () => {
    if (!activeBusiness) return;
    setSaving(true); setError(''); setSuccess('');
    const { error: rpcError } = await supabase.rpc('submit_merchant_business_for_review', {
      p_business_id: activeBusiness.id,
    });
    if (rpcError) setError(rpcError.message);
    else { setSuccess('Pengajuan verifikasi berhasil dikirim. Bisnis belum tampil publik sampai disetujui.'); await load(); }
    setSaving(false);
  };

  const acceptInvitation = async () => {
    if (!activeBusiness) return;
    const membershipId = pendingInvitationIds[activeBusiness.id];
    if (!membershipId) return;
    setSaving(true); setError(''); setSuccess('');
    const { data, error: acceptError } = await supabase.rpc('accept_merchant_invitation', {
      p_membership_id: membershipId,
    });
    if (acceptError) setError(acceptError.message);
    else if (data !== true) setError('Undangan tidak lagi tersedia atau sudah diproses.');
    else {
      setSuccess('Undangan diterima. Akses bisnis sekarang aktif.');
      await refreshRole();
      await load();
    }
    setSaving(false);
  };

  const inviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness || !inviteEmail.trim()) return;
    setSaving(true); setError(''); setSuccess('');
    const { error: inviteError } = await supabase.rpc('invite_merchant_member_by_email', {
      p_business_id: activeBusiness.id,
      p_email: inviteEmail.trim(),
      p_member_role: inviteRole,
    });
    if (inviteError) setError(inviteError.message);
    else {
      setInviteEmail('');
      setSuccess('Undangan berhasil dibuat dan notifikasi YUKU dikirim ke akun penerima. Akses baru aktif setelah undangan diterima.');
      await loadTeam();
      await refreshRole();
    }
    setSaving(false);
  };

  const revokeMember = async (member: MerchantMember) => {
    if (!activeBusiness || !window.confirm(`Cabut akses ${member.email || 'anggota ini'} dari bisnis?`)) return;
    setSaving(true); setError(''); setSuccess('');
    const { error: revokeError } = await supabase.rpc('revoke_merchant_business_member', {
      p_business_id: activeBusiness.id,
      p_membership_id: member.membership_id,
    });
    if (revokeError) setError(revokeError.message);
    else {
      setSuccess('Akses anggota berhasil dicabut.');
      await loadTeam();
      await refreshRole();
    }
    setSaving(false);
  };

  if (!user) {
    return (
      <section className="mx-auto max-w-xl px-4 py-16 text-center">
        <Building2 className="mx-auto mb-4 h-10 w-10 text-purple-700" />
        <h1 className="text-2xl font-black text-slate-900">Merchant Center</h1>
        <p className="mt-2 text-sm text-slate-600">Masuk ke akun YUKU untuk mendaftarkan dan mengelola bisnis.</p>
        <button onClick={() => onNavigate('/login')} className="mt-6 rounded-xl bg-purple-800 px-5 py-3 text-sm font-bold text-white">Masuk ke YUKU</button>
      </section>
    );
  }

  return (
    <main className="min-h-[70vh] bg-[radial-gradient(circle_at_top_left,_rgba(233,213,255,0.55),_transparent_35%),linear-gradient(180deg,#faf8ff_0%,#fff_55%)] px-4 py-7 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => onNavigate('/')} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-purple-800 hover:text-purple-950"><ArrowLeft className="h-4 w-4" /> Kembali ke Beranda</button>
        <div className="mb-7 rounded-3xl bg-gradient-to-br from-[#261044] via-[#45206f] to-[#741c70] p-5 text-white shadow-xl sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3"><Store className="h-7 w-7 text-fuchsia-200" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-fuchsia-200">YUKU Business Ecosystem</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Merchant Center</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-purple-100">Kelola profil bisnis dan cabang usaha. Setelah disetujui, bisnis dapat ditemukan pelanggan melalui Merchant Partner.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 text-xs text-purple-100 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">Profil bisnis terpisah dari profil Talent</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">Satu bisnis dapat memiliki beberapa lokasi</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">Pembayaran dilakukan langsung ke merchant</div>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        {success && <div role="status" className="mb-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat Merchant Center...</div>
        ) : businesses.length === 0 ? (
          <form onSubmit={createBusiness} className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-extrabold text-slate-900">Daftarkan bisnis pertama</h2>
            <p className="mb-5 mt-1 text-xs leading-5 text-slate-500">Gunakan nama dan informasi bisnis yang benar. Pengajuan akan berstatus draft sampai lokasi ditambahkan dan dikirim untuk verifikasi.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Nama bisnis *</span><input className={inputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} required placeholder="Contoh: Kopi Senja" /></label>
              <label><span className={labelClass}>Kategori bisnis</span><input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} placeholder="Kuliner, olahraga, retail..." /></label>
              <label><span className={labelClass}>Nomor kontak publik</span><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="Nomor WhatsApp bisnis" /></label>
              <label><span className={labelClass}>Website / tautan bisnis</span><input type="url" inputMode="url" className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={500} placeholder="https://" /></label>
            </div>
            <label className="mt-4 block"><span className={labelClass}>Deskripsi bisnis</span><textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Ceritakan bisnis dan layanan utama..." /></label>
            <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/15 disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? 'Menyimpan...' : 'Buat Profil Bisnis'}</button>
            {memberships.length > 0 && <p className="mt-3 text-[11px] text-slate-500">Membership terdeteksi: {memberships.length} bisnis. Jika daftar belum muncul, muat ulang halaman.</p>}
          </form>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <section className="space-y-5">
              {businesses.length > 1 && <label className="block"><span className={labelClass}>Pilih bisnis</span><select className={inputClass} value={activeBusiness?.id || ''} onChange={(e) => setActiveBusinessId(e.target.value)}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.business_name}</option>)}</select></label>}
              {activeBusiness && <>
                {activeMembership?.status === 'invited' && <section className="rounded-2xl border border-purple-200 bg-purple-50 p-4"><p className="text-xs font-extrabold text-purple-950">Undangan bergabung ke bisnis</p><p className="mt-1 text-[11px] leading-5 text-purple-800">Anda diundang sebagai {activeMembership.role === 'manager' ? 'Manager' : 'Staff'} di bisnis {activeBusiness.business_name}. Terima undangan untuk mengaktifkan akses.</p><button type="button" onClick={() => void acceptInvitation()} disabled={saving || !pendingInvitationIds[activeBusiness.id]} className="mt-3 rounded-xl bg-purple-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Terima undangan</button></section>}
                <form onSubmit={saveBusiness} className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div><h2 className="text-base font-extrabold text-slate-900">Profil bisnis</h2><p className="mt-1 text-[11px] text-slate-500">Informasi publik Merchant Partner</p></div>
                    <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-bold text-purple-800">{activeBusiness.review_status.replace('_',' ')}</span>
                  </div>
                  <div className="mb-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><Clock3 className="h-4 w-4 shrink-0 text-purple-700" />{statusCopy[activeBusiness.review_status]}</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label><span className={labelClass}>Nama bisnis *</span><input className={inputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} required disabled={!canEdit} /></label>
                    <label><span className={labelClass}>Kategori</span><input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} disabled={!canEdit} /></label>
                    <label><span className={labelClass}>Kontak publik</span><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} disabled={!canEdit} /></label>
                    <label><span className={labelClass}>Website</span><input type="url" inputMode="url" className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={500} disabled={!canEdit} /></label>
                  </div>
                  <label className="mt-4 block"><span className={labelClass}>Deskripsi</span><textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={!canEdit} /></label>
                  {canEdit && <button disabled={saving} className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-bold text-purple-900 disabled:opacity-60">Simpan Profil</button>}
                  {!isOwner && activeMembership?.role === 'manager' && <p className="mt-3 text-[11px] text-slate-500">Akses Manager: dapat mengelola lokasi, tetapi perubahan identitas bisnis dan pengajuan verifikasi hanya dapat dilakukan Owner.</p>}
                </form>
                <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-extrabold text-slate-900">Lokasi & cabang</h2><p className="mt-1 text-[11px] text-slate-500">{locations.length} lokasi terdaftar</p></div><MapPin className="h-5 w-5 text-purple-700" /></div>
                  {locations.map((location) => <div key={location.id} className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{location.location_name}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{location.address_text}{location.city ? `, ${location.city}` : ''}{location.province ? `, ${location.province}` : ''}</p></div>)}
                  {activeBusiness.review_status === 'approved' && isOwner && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">Penambahan cabang pada bisnis yang sudah tayang akan mengirim ulang profil untuk pemeriksaan YUKU. Bisnis disembunyikan sementara sampai pemeriksaan selesai.</p>}
                  {activeBusiness.review_status === 'approved' && !isOwner && <p className="mb-3 rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-500">Cabang baru pada bisnis yang sudah tayang hanya dapat ditambahkan Owner agar alamat baru diperiksa terlebih dahulu.</p>}
                  {canManageLocations && <form onSubmit={addLocation} className="mt-4 border-t border-slate-100 pt-4">
                    <h3 className="mb-3 text-xs font-extrabold text-slate-800">Tambah lokasi</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label><span className={labelClass}>Nama lokasi *</span><input className={inputClass} value={locationName} onChange={(e) => setLocationName(e.target.value)} maxLength={120} required /></label>
                      <label><span className={labelClass}>Nomor telepon lokasi</span><input className={inputClass} value={locationPhone} onChange={(e) => setLocationPhone(e.target.value)} maxLength={40} /></label>
                      <label className="sm:col-span-2"><span className={labelClass}>Alamat lengkap *</span><input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} required placeholder="Jalan, nomor, gedung, patokan..." /></label>
                      <label><span className={labelClass}>Kota / Kabupaten</span><input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} /></label>
                      <label><span className={labelClass}>Provinsi</span><input className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)} maxLength={100} /></label>
                    </div>
                    <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-bold text-purple-900"><Plus className="h-4 w-4" /> Tambah Lokasi</button>
                  </form>}
                </section>
                {canSubmitForReview && <button onClick={submitForReview} disabled={saving || locations.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-800 to-fuchsia-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-900/15 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /> Ajukan Verifikasi Bisnis</button>}
                {['owner','manager'].includes(activeMembership?.role || '') && activeMembership?.status === 'active' && <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-slate-900">Tim bisnis</h2><p className="mt-1 text-[11px] text-slate-500">Kelola akses orang yang membantu operasional bisnis.</p></div><Users className="h-5 w-5 text-purple-700" /></div>
                  {teamLoading ? <p className="text-xs text-slate-500">Memuat anggota...</p> : <div className="space-y-2">
                    {teamMembers.map((member) => <div key={member.membership_id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                      <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{member.email || 'Email tidak tersedia'}</p><p className="mt-1 text-[10px] text-slate-500">{member.member_role === 'owner' ? 'Owner' : member.member_role === 'manager' ? 'Manager' : 'Staff'} · {member.membership_status === 'active' ? 'Aktif' : member.membership_status === 'pending_invitation' ? 'Menunggu diterima' : member.membership_status}</p></div>
                      {isOwner && member.member_role !== 'owner' && member.membership_status !== 'revoked' && <button type="button" onClick={() => void revokeMember(member)} disabled={saving} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-[10px] font-bold text-rose-700 disabled:opacity-50"><UserMinus className="h-3 w-3" /> Cabut akses</button>}
                    </div>)}
                    {teamMembers.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">Belum ada anggota lain di bisnis ini.</p>}
                  </div>}
                  {isOwner && <form onSubmit={inviteMember} className="mt-4 border-t border-slate-100 pt-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold text-slate-800"><UserPlus className="h-4 w-4 text-purple-700" /> Undang anggota</h3>
                    <label className="block"><span className={labelClass}>Email akun YUKU</span><input type="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nama@email.com" className={inputClass} /></label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><label><span className={labelClass}>Hak akses</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'manager' | 'staff')} className={inputClass}><option value="staff">Staff — akses operasional terbatas</option><option value="manager">Manager — kelola lokasi & lihat tim</option></select></label><button disabled={saving || !inviteEmail.trim()} className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-purple-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" /> Buat undangan</button></div>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">Undangan hanya untuk akun YUKU aktif. Penerima mendapat notifikasi di lonceng YUKU dan harus menerima undangan sebelum akses aktif.</p>
                  </form>}
                  {!isOwner && <p className="mt-3 text-[10px] text-slate-500">Manager dapat melihat daftar tim, tetapi undangan dan pencabutan akses hanya dapat dilakukan Owner.</p>}
                </section>}
              </>}
            </section>
            <aside className="h-fit rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
              <h3 className="text-sm font-extrabold text-amber-950">Cara kerja Merchant Partner</h3>
              <ol className="mt-3 space-y-3 text-xs leading-5 text-amber-900">
                <li><b>1. Daftarkan bisnis</b><br/>Isi profil usaha dan kontak publik.</li>
                <li><b>2. Tambahkan lokasi</b><br/>Masukkan alamat cabang yang ingin ditampilkan.</li>
                <li><b>3. Ajukan verifikasi</b><br/>Tim YUKU memeriksa informasi bisnis.</li>
                <li><b>4. Tampil di Jelajah</b><br/>Hanya bisnis yang disetujui yang dapat ditampilkan ke publik.</li>
              </ol>
              <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 text-[11px] leading-5 text-amber-900">Transaksi barang/jasa merchant dibayar langsung ke merchant. Checkout, voucher, komisi, dan settlement merchant belum termasuk tahap ini.</div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
};
