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
  opening_hours: Record<string, unknown>;
}
interface MerchantMember {
  membership_id: string;
  email: string | null;
  member_role: 'owner' | 'manager' | 'staff';
  membership_status: 'pending_invitation' | 'active' | 'suspended' | 'revoked';
  invited_at: string | null;
  accepted_at: string | null;
}
interface MerchantOffer {
  id: string;
  title: string;
  description: string;
  offer_type: 'discount' | 'bundle' | 'event' | 'benefit' | 'other';
  starts_at: string;
  ends_at: string | null;
  eligibility: string | null;
  quota: number | null;
  funded_by: 'merchant';
  terms: string | null;
  redemption_instructions: string | null;
  status: 'draft' | 'pending_review' | 'approved' | 'needs_revision' | 'rejected' | 'suspended';
}
interface MerchantOfferHistory {
  id: string;
  offer_id: string;
  from_status: string | null;
  to_status: string;
  decision_note: string | null;
  created_at: string;
}
interface MerchantReviewEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  decision_note: string | null;
  actor_role: 'owner' | 'admin' | 'system';
  created_at: string;
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
const toLocalDateTimeInput = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const MerchantCenterPage: React.FC<Props> = ({ onNavigate }) => {
  const { user, accessSnapshot, refreshRole } = useAuth();
  const [businesses, setBusinesses] = useState<MerchantBusiness[]>([]);
  const [locations, setLocations] = useState<MerchantLocation[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateBusinessForm, setShowCreateBusinessForm] = useState(false);
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
  const [openingHours, setOpeningHours] = useState('');
  const [teamMembers, setTeamMembers] = useState<MerchantMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [pendingInvitationIds, setPendingInvitationIds] = useState<Record<string,string>>({});
  const [reviewHistory, setReviewHistory] = useState<MerchantReviewEvent[]>([]);
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState(false);
  const [offers, setOffers] = useState<MerchantOffer[]>([]);
  const [offerHistoryRows, setOfferHistoryRows] = useState<MerchantOfferHistory[]>([]);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerType, setOfferType] = useState<MerchantOffer['offer_type']>('discount');
  const [offerStart, setOfferStart] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [offerEnd, setOfferEnd] = useState('');
  const [offerEligibility, setOfferEligibility] = useState('');
  const [offerQuota, setOfferQuota] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [offerInstructions, setOfferInstructions] = useState('');
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

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

  const load = useCallback(async (preferredBusinessId?: string) => {
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
    const preferredId = preferredBusinessId || activeBusinessId;
    const nextId = rows.some((row) => row.id === preferredId) ? preferredId : rows[0]?.id || '';
    setActiveBusinessId(nextId);
    if (nextId) {
      const { data: locationRows, error: locationError } = await supabase
        .from('merchant_locations')
        .select('id,business_id,location_name,address_text,city,province,is_active,opening_hours')
        .eq('business_id', nextId)
        .order('created_at', { ascending: true });
      if (locationError) setError('Profil bisnis terbaca, tetapi daftar lokasi belum dapat dimuat.');
      setLocations((locationRows || []) as MerchantLocation[]);
      const { data: offerRows, error: offerError } = await supabase
        .from('merchant_offers')
        .select('id,title,description,offer_type,starts_at,ends_at,eligibility,quota,funded_by,terms,redemption_instructions,status')
        .eq('business_id', nextId)
        .order('created_at', { ascending: false });
      if (offerError) {
        setOffers([]);
        setError('Fitur promo Merchant Partner belum tersedia di server. Pastikan migrasi Merchant Offers sudah diterapkan di staging.');
      } else setOffers((offerRows || []) as MerchantOffer[]);
    } else {
      setLocations([]);
      setOffers([]);
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

  const loadReviewHistory = useCallback(async () => {
    if (!activeBusiness || !isOwner) {
      setReviewHistory([]);
      return;
    }
    setReviewHistoryLoading(true);
    const { data, error: historyError } = await supabase
      .from('merchant_business_review_history')
      .select('id,from_status,to_status,decision_note,actor_role,created_at')
      .eq('business_id', activeBusiness.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!historyError) setReviewHistory((data || []) as MerchantReviewEvent[]);
    else setReviewHistory([]);
    setReviewHistoryLoading(false);
  }, [activeBusiness?.id, isOwner]);

  useEffect(() => { void loadReviewHistory(); }, [loadReviewHistory]);

  const loadOfferHistory = useCallback(async () => {
    if (!activeBusiness || !isOwner) {
      setOfferHistoryRows([]);
      return;
    }
    const offerIds = offers.map((offer) => offer.id);
    if (offerIds.length === 0) {
      setOfferHistoryRows([]);
      return;
    }
    const { data, error: historyError } = await supabase
      .from('merchant_offer_history')
      .select('id,offer_id,from_status,to_status,decision_note,created_at')
      .in('offer_id', offerIds)
      .order('created_at', { ascending: false });
    if (!historyError) setOfferHistoryRows((data || []) as MerchantOfferHistory[]);
    else setOfferHistoryRows([]);
  }, [activeBusiness?.id, isOwner, offers]);

  useEffect(() => { void loadOfferHistory(); }, [loadOfferHistory]);

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
      setShowCreateBusinessForm(false);
      setSuccess('Profil bisnis berhasil dibuat sebagai draft. Tambahkan lokasi usaha sebelum mengajukan verifikasi.');
      await refreshRole();
      await load(String(data));
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
      p_opening_hours: openingHours.trim() ? { display: openingHours.trim() } : {},
    });
    if (rpcError) setError(rpcError.message);
    else {
      setAddress(''); setOpeningHours(''); setSuccess('Lokasi usaha berhasil ditambahkan.');
      await load();
      await loadReviewHistory();
    }
    setSaving(false);
  };

  const createOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness) return;
    setSaving(true); setError(''); setSuccess('');
    const { error: offerError } = await supabase.rpc('save_merchant_offer', {
      p_business_id: activeBusiness.id,
      p_offer_id: editingOfferId,
      p_title: offerTitle.trim(),
      p_description: offerDescription.trim(),
      p_offer_type: offerType,
      p_starts_at: offerStart ? new Date(offerStart).toISOString() : new Date().toISOString(),
      p_ends_at: offerEnd ? new Date(offerEnd).toISOString() : null,
      p_eligibility: offerEligibility.trim() || null,
      p_quota: offerQuota.trim() ? Number(offerQuota) : null,
      p_terms: offerTerms.trim() || null,
      p_redemption_instructions: offerInstructions.trim() || null,
    });
    if (offerError) setError(offerError.message);
    else {
      setOfferTitle(''); setOfferDescription(''); setOfferStart(toLocalDateTimeInput(new Date().toISOString())); setOfferEnd('');
      setOfferEligibility(''); setOfferQuota(''); setOfferTerms(''); setOfferInstructions(''); setEditingOfferId(null);
      setSuccess('Promo berhasil disimpan sebagai draft. Owner perlu mengajukannya untuk pemeriksaan YUKU.');
      await load();
      await loadOfferHistory();
    }
    setSaving(false);
  };

  const editOffer = (offer: MerchantOffer) => {
    setEditingOfferId(offer.id);
    setOfferTitle(offer.title);
    setOfferDescription(offer.description);
    setOfferType(offer.offer_type);
    setOfferStart(toLocalDateTimeInput(offer.starts_at));
    setOfferEnd(toLocalDateTimeInput(offer.ends_at));
    setOfferEligibility(offer.eligibility || '');
    setOfferQuota(offer.quota ? String(offer.quota) : '');
    setOfferTerms(offer.terms || '');
    setOfferInstructions(offer.redemption_instructions || '');
    setError('');
    setSuccess('');
  };

  const submitOfferForReview = async (offerId: string) => {
    setSaving(true); setError(''); setSuccess('');
    const { error: submitError } = await supabase.rpc('submit_merchant_offer_for_review', {
      p_offer_id: offerId,
    });
    if (submitError) setError(submitError.message);
    else {
      setSuccess('Promo dikirim untuk pemeriksaan YUKU. Promo belum tampil di direktori sampai disetujui.');
      await load();
      await loadOfferHistory();
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
    else { setSuccess('Pengajuan verifikasi berhasil dikirim. Bisnis belum tampil publik sampai disetujui.'); await load(); await loadReviewHistory(); }
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button onClick={() => onNavigate('/')} className="inline-flex items-center gap-2 text-xs font-bold text-purple-800 hover:text-purple-950"><ArrowLeft className="h-4 w-4" /> Kembali ke Beranda</button>{businesses.length > 0 && !showCreateBusinessForm && <button type="button" onClick={() => setShowCreateBusinessForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-4 w-4" /> Tambah Bisnis</button>}</div>
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
        ) : businesses.length === 0 || showCreateBusinessForm ? (
          <form onSubmit={createBusiness} className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-slate-900">{businesses.length === 0 ? 'Daftarkan bisnis pertama' : 'Tambah bisnis Merchant Partner'}</h2>{businesses.length > 0 && <button type="button" onClick={() => setShowCreateBusinessForm(false)} className="text-xs font-bold text-slate-500">Batal</button>}</div>
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
                {activeBusiness.review_status === 'approved' && <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-slate-900">Promo & penawaran</h2><p className="mt-1 text-[11px] text-slate-500">Informasi promo merchant yang dapat ditukarkan langsung di lokasi.</p></div><Store className="h-5 w-5 text-purple-700" /></div>
                  <div className="space-y-2">{offers.map((offer) => <div key={offer.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-extrabold text-slate-800">{offer.title}</p><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-purple-800">{offer.status === 'pending_review' ? 'Menunggu pemeriksaan' : offer.status === 'approved' ? 'Tayang' : offer.status === 'needs_revision' ? 'Perlu perbaikan' : offer.status === 'rejected' ? 'Ditolak' : offer.status === 'suspended' ? 'Dinonaktifkan' : 'Draft'}</span></div><p className="mt-1 text-[11px] leading-5 text-slate-600">{offer.description}</p>{isOwner && offerHistoryRows.find((event) => event.offer_id === offer.id && event.decision_note) && <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-[10px] leading-5 text-amber-900">Catatan YUKU: {offerHistoryRows.find((event) => event.offer_id === offer.id && event.decision_note)?.decision_note}</p>}{offer.eligibility && <p className="mt-1 text-[10px] text-slate-500">Syarat peserta: {offer.eligibility}</p>}<p className="mt-1 text-[10px] text-slate-500">{offer.quota ? 'Kuota: '+offer.quota : 'Kuota: tidak dibatasi'} · Ditanggung merchant</p>{offer.ends_at && <p className="mt-1 text-[10px] text-slate-500">Berakhir {new Date(offer.ends_at).toLocaleDateString('id-ID')}</p>}{['owner','manager'].includes(activeMembership?.role || '') && ['draft','needs_revision','approved'].includes(offer.status) && <button type="button" onClick={() => editOffer(offer)} disabled={saving} className="mt-2 mr-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-[10px] font-bold text-purple-800 disabled:opacity-50">Edit promo</button>}{isOwner && ['draft','needs_revision'].includes(offer.status) && <button type="button" onClick={() => void submitOfferForReview(offer.id)} disabled={saving} className="mt-2 rounded-lg bg-purple-800 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Ajukan pemeriksaan</button>}</div>)}{offers.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">Belum ada promo untuk bisnis ini.</p>}</div>
                  {['owner','manager'].includes(activeMembership?.role || '') && activeMembership?.status === 'active' && <form onSubmit={createOffer} className="mt-4 border-t border-slate-100 pt-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-extrabold text-slate-800">{editingOfferId ? 'Edit promo' : 'Buat promo baru'}</h3>{editingOfferId && <button type="button" onClick={() => {setEditingOfferId(null);setOfferTitle('');setOfferDescription('');setOfferStart(toLocalDateTimeInput(new Date().toISOString()));setOfferEnd('');setOfferEligibility('');setOfferQuota('');setOfferTerms('');setOfferInstructions('');}} className="text-[10px] font-bold text-slate-500">Batal edit</button>}</div><div className="grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Judul promo *</span><input className={inputClass} value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} maxLength={100} required placeholder="Contoh: Diskon 20% weekday" /></label><label><span className={labelClass}>Jenis penawaran</span><select className={inputClass} value={offerType} onChange={(e) => setOfferType(e.target.value as MerchantOffer['offer_type'])}><option value="discount">Diskon</option><option value="bundle">Paket / bundling</option><option value="event">Event</option><option value="benefit">Benefit khusus</option><option value="other">Lainnya</option></select></label></div><label className="mt-3 block"><span className={labelClass}>Deskripsi *</span><textarea className={inputClass} rows={3} value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} maxLength={1200} minLength={10} required placeholder="Jelaskan promo, manfaat, dan siapa yang bisa menggunakannya." /></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Mulai berlaku</span><input type="datetime-local" required className={inputClass} value={offerStart} onChange={(e) => setOfferStart(e.target.value)} min={editingOfferId ? undefined : toLocalDateTimeInput(new Date().toISOString())} /></label><label><span className={labelClass}>Berlaku sampai (opsional)</span><input type="datetime-local" className={inputClass} value={offerEnd} onChange={(e) => setOfferEnd(e.target.value)} min={offerStart || toLocalDateTimeInput(new Date().toISOString())} /></label><label><span className={labelClass}>Kuota (opsional)</span><input type="number" min={1} step={1} className={inputClass} value={offerQuota} onChange={(e) => setOfferQuota(e.target.value)} placeholder="Kosongkan jika tanpa batas" /></label><label className="sm:col-span-2"><span className={labelClass}>Syarat peserta / eligibility</span><input className={inputClass} value={offerEligibility} onChange={(e) => setOfferEligibility(e.target.value)} maxLength={500} placeholder="Contoh: Pengguna baru, Senin–Jumat, minimal pembelian..." /></label><label><span className={labelClass}>Cara penukaran</span><input className={inputClass} value={offerInstructions} onChange={(e) => setOfferInstructions(e.target.value)} maxLength={500} placeholder="Tunjukkan halaman promo ini di kasir" /></label></div><label className="mt-3 block"><span className={labelClass}>Syarat & ketentuan</span><textarea className={inputClass} rows={2} value={offerTerms} onChange={(e) => setOfferTerms(e.target.value)} maxLength={1000} placeholder="Ketentuan penggunaan promo..." /></label><button disabled={saving || !offerTitle.trim() || offerDescription.trim().length < 10} className="mt-3 rounded-xl bg-purple-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{editingOfferId ? 'Simpan perubahan' : 'Simpan draft promo'}</button><p className="mt-2 text-[10px] leading-5 text-slate-500">Promo harus disetujui YUKU sebelum tampil. Kuota hanya informasi dan tidak dikurangi otomatis. Penukaran dan pembayaran dilakukan langsung dengan merchant; tidak ada checkout atau voucher saldo YUKU.</p></form>}
                </section>}
                {isOwner && <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-slate-900">Riwayat verifikasi</h2><p className="mt-1 text-[11px] text-slate-500">Catatan pemeriksaan dan perubahan status bisnis.</p></div><Clock3 className="h-5 w-5 text-purple-700" /></div>
                  {reviewHistoryLoading ? <p className="text-xs text-slate-500">Memuat riwayat...</p> : reviewHistory.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">Belum ada catatan pemeriksaan.</p> : <div className="space-y-3">{reviewHistory.map((event) => <div key={event.id} className="border-l-2 border-purple-200 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-800">{event.to_status === 'pending_review' ? 'Diajukan untuk verifikasi' : event.to_status === 'approved' ? 'Bisnis disetujui' : event.to_status === 'needs_revision' ? 'Perlu perbaikan' : event.to_status === 'rejected' ? 'Pengajuan ditolak' : event.to_status === 'suspended' ? 'Bisnis dinonaktifkan' : event.to_status}</p><time className="text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</time></div>{event.decision_note && <p className="mt-1 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-900">{event.decision_note}</p>}<p className="mt-1 text-[10px] text-slate-400">{event.actor_role === 'owner' ? 'Dikirim oleh Owner' : event.actor_role === 'admin' ? 'Tim Verifikasi YUKU' : 'Sistem YUKU'}</p></div>)}</div>}
                </section>}
                <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-extrabold text-slate-900">Lokasi & cabang</h2><p className="mt-1 text-[11px] text-slate-500">{locations.length} lokasi terdaftar</p></div><MapPin className="h-5 w-5 text-purple-700" /></div>
                  {locations.map((location) => <div key={location.id} className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{location.location_name}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{location.address_text}{location.city ? `, ${location.city}` : ''}{location.province ? `, ${location.province}` : ''}</p>{typeof location.opening_hours?.display === 'string' && <p className="mt-1 text-[10px] text-slate-500">Jam operasional: {location.opening_hours.display}</p>}</div>)}
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
                      <label className="sm:col-span-2"><span className={labelClass}>Jam operasional</span><input className={inputClass} value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} maxLength={160} placeholder="Contoh: Setiap hari, 09.00–21.00" /></label>
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
