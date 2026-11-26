import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';

interface Props { onNavigate: (path: AppRoute) => void; }
interface MerchantRow {
  id: string;
  business_name: string;
  description: string | null;
  business_category: string | null;
  public_phone: string | null;
  website_url: string | null;
  review_status: string;
  created_at: string;
}
interface LocationRow {
  id: string;
  business_id: string;
  location_name: string;
  address_text: string;
  city: string | null;
  province: string | null;
  public_phone: string | null;
  is_active: boolean;
}
interface HistoryRow {
  id: string;
  business_id: string;
  from_status: string | null;
  to_status: string;
  decision_note: string | null;
  actor_role: string;
  created_at: string;
}
interface OfferRow {
  id: string;
  business_id: string;
  title: string;
  description: string;
  offer_type: string;
  starts_at: string;
  ends_at: string | null;
  eligibility: string | null;
  quota: number | null;
  funded_by: 'merchant';
  terms: string | null;
  redemption_instructions: string | null;
  status: string;
  business_name: string;
}
interface OfferHistoryRow {
  id: string;
  offer_id: string;
  from_status: string | null;
  to_status: string;
  decision_note: string | null;
  actor_role: string;
  created_at: string;
}
const statusLabel: Record<string,string> = {
  draft:'Draft', pending_review:'Menunggu review', needs_revision:'Perlu revisi',
  approved:'Disetujui', rejected:'Ditolak', suspended:'Dinonaktifkan',
};

export const AdminMerchantReviewPage: React.FC<Props> = ({ onNavigate }) => {
  const { role, adminAccess, isAuthLoading } = useAuth();
  const [authorized,setAuthorized] = useState<boolean | null>(null);
  const [rows,setRows] = useState<MerchantRow[]>([]);
  const [locations,setLocations] = useState<LocationRow[]>([]);
  const [history,setHistory] = useState<HistoryRow[]>([]);
  const [filter,setFilter] = useState<'pending_review'|'approved'|'all'>('pending_review');
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const [actingId,setActingId] = useState<string|null>(null);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [historyReady,setHistoryReady] = useState(false);
  const [offerRows,setOfferRows] = useState<OfferRow[]>([]);
  const [offerHistory,setOfferHistory] = useState<OfferHistoryRow[]>([]);
  const [offerNotes,setOfferNotes] = useState<Record<string,string>>({});
  const [offerLoading,setOfferLoading] = useState(false);
  const [offerHistoryReady,setOfferHistoryReady] = useState(false);
  const [actingOfferId,setActingOfferId] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setHistoryReady(false);
    let query = supabase.from('merchant_businesses')
      .select('id,business_name,description,business_category,public_phone,website_url,review_status,created_at')
      .order('created_at',{ascending:false});
    if(filter === 'pending_review') query = query.eq('review_status','pending_review');
    if(filter === 'approved') query = query.eq('review_status','approved');
    const {data,error:queryError}=await query;
    if(queryError){setError('Antrean Merchant belum tersedia. Pastikan migrasi Merchant Partner sudah diterapkan di staging.');setRows([]);setLocations([]);setHistory([]);setLoading(false);return;}
    const businesses=(data||[]) as MerchantRow[];
    setRows(businesses);
    const ids=businesses.map((item)=>item.id);
    if(!ids.length){setLocations([]);setHistory([]);setHistoryReady(true);setLoading(false);return;}
    const [{data:locationRows,error:locationError},{data:historyRows,error:historyError}]=await Promise.all([
      supabase.from('merchant_locations').select('id,business_id,location_name,address_text,city,province,public_phone,is_active').in('business_id',ids).order('created_at',{ascending:true}),
      supabase.from('merchant_business_review_history').select('id,business_id,from_status,to_status,decision_note,actor_role,created_at').in('business_id',ids).order('created_at',{ascending:false}),
    ]);
    if(locationError) setError('Profil bisnis terbaca, tetapi daftar lokasi gagal dimuat.');
    if(historyError) setError('Riwayat audit gagal dimuat. Keputusan review dikunci sampai riwayat dapat diperiksa.');
    setHistoryReady(!historyError && !locationError);
    setLocations((locationRows||[]) as LocationRow[]);
    setHistory((historyRows||[]) as HistoryRow[]);
    setLoading(false);
  },[filter]);

  const loadOffers = useCallback(async () => {
    setOfferLoading(true); setOfferHistoryReady(false);
    const { data, error: offerError } = await supabase
      .from('merchant_offers')
      .select('id,business_id,title,description,offer_type,starts_at,ends_at,eligibility,quota,funded_by,terms,redemption_instructions,status')
      .in('status',['pending_review','approved'])
      .order('created_at',{ascending:false});
    if (offerError) {
      setOfferRows([]); setOfferHistory([]);
      setError('Antrean promo belum tersedia. Pastikan migrasi Merchant Offers diterapkan di staging.');
      setOfferLoading(false); return;
    }
    const offers=(data||[]) as Omit<OfferRow,'business_name'>[];
    if (!offers.length) {
      setOfferRows([]); setOfferHistory([]); setOfferHistoryReady(true); setOfferLoading(false); return;
    }
    const businessIds=[...new Set(offers.map((offer)=>offer.business_id))];
    const [{data:businessRows,error:businessError},{data:historyRows,error:historyError}]=await Promise.all([
      supabase.from('merchant_businesses').select('id,business_name').in('id',businessIds),
      supabase.from('merchant_offer_history').select('id,offer_id,from_status,to_status,decision_note,actor_role,created_at').in('offer_id',offers.map((offer)=>offer.id)).order('created_at',{ascending:false}),
    ]);
    const names=new Map((businessRows||[]).map((business:{id:string;business_name:string})=>[business.id,business.business_name]));
    setOfferRows(offers.map((offer)=>({...offer,business_name:names.get(offer.business_id)||'Merchant Partner'})));
    setOfferHistory((historyRows||[]) as OfferHistoryRow[]);
    setOfferHistoryReady(!historyError && !businessError);
    if (historyError || businessError) setError('Detail bisnis atau riwayat promo gagal dimuat. Keputusan promo dikunci sampai data dapat diperiksa.');
    setOfferLoading(false);
  },[]);

  const decideOffer=async(id:string,decision:'approved'|'needs_revision'|'rejected'|'suspended')=>{
    const note=(offerNotes[id]||'').trim();
    if(['needs_revision','rejected','suspended'].includes(decision)&&note.length<8){
      setError('Isi catatan minimal 8 karakter untuk revisi, penolakan, atau penonaktifan promo.');return;
    }
    setActingOfferId(id);setError('');setSuccess('');
    const {error:rpcError}=await supabase.rpc('admin_review_merchant_offer',{
      p_offer_id:id,p_decision:decision,p_decision_note:note||null,
    });
    if(rpcError)setError(rpcError.message);
    else{setSuccess('Keputusan promo berhasil disimpan dan masuk ke riwayat audit.');setOfferNotes((old)=>({...old,[id]:''}));await loadOffers();}
    setActingOfferId(null);
  };

  useEffect(()=>{
    if(isAuthLoading)return;
    const allowed=role==='admin' && adminAccess?.isSuperAdmin===true;
    setAuthorized(allowed);
    if(allowed) { void load(); void loadOffers(); } else setLoading(false);
  },[role,adminAccess,isAuthLoading,load,loadOffers]);

  const decide=async(id:string,decision:'approved'|'needs_revision'|'rejected'|'suspended')=>{
    const note=(notes[id]||'').trim();
    if(['needs_revision','rejected','suspended'].includes(decision) && note.length<8){
      setError('Isi catatan minimal 8 karakter untuk revisi, penolakan, atau penonaktifan.');return;
    }
    setActingId(id);setError('');setSuccess('');
    const {error:rpcError}=await supabase.rpc('admin_review_merchant_business',{
      p_business_id:id,p_decision:decision,p_decision_note:note||null,
    });
    if(rpcError)setError(rpcError.message);
    else{setSuccess('Keputusan Merchant berhasil disimpan dan masuk ke riwayat audit.');setNotes((old)=>({...old,[id]:''}));await load();}
    setActingId(null);
  };

  if(isAuthLoading||authorized===null)return <div className="min-h-[50vh] p-8 text-center text-sm text-slate-500">Memeriksa akses Super Admin...</div>;
  if(!authorized)return <div className="min-h-[60vh] px-4 py-12 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-rose-500"/><h1 className="mt-3 text-lg font-extrabold text-slate-900">Akses dibatasi</h1><p className="mt-2 text-xs text-slate-500">Review Merchant saat ini hanya tersedia untuk Super Admin.</p><button onClick={()=>onNavigate('/admin')} className="mt-5 rounded-xl bg-[#24105F] px-4 py-2.5 text-xs font-bold text-white">Kembali ke Admin</button></div>;

  const visibleRows=rows.filter((row)=>filter!=='all'||['pending_review','approved'].includes(row.review_status));
  return <main className="min-h-screen bg-[#F8F7FC] pb-12">
    <header className="bg-gradient-to-br from-[#24105F] to-[#741C70] px-4 py-6 text-white"><div className="mx-auto max-w-5xl">
      <button onClick={()=>onNavigate('/admin')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-violet-100"><ArrowLeft className="h-4 w-4"/> Kembali ke Admin</button>
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-200">YUKU Admin · Merchant Partner</p><h1 className="mt-1 text-2xl font-black">Review Bisnis</h1><p className="mt-2 text-xs text-violet-100">Periksa profil dan lokasi sebelum bisnis dipublikasikan.</p></div><button onClick={()=>{void load();void loadOffers();}} disabled={loading||offerLoading} aria-label="Muat ulang antrean" className="rounded-xl bg-white/15 p-3"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div>
    </div></header>
    <div className="mx-auto max-w-5xl px-4">
      <div className="-mt-4 flex gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {(['pending_review','approved','all'] as const).map((value)=><button key={value} onClick={()=>setFilter(value)} className={`rounded-full px-3 py-2 text-[10px] font-bold ${filter===value?'bg-[#24105F] text-white':'bg-slate-100 text-slate-600'}`}>{value==='pending_review'?'Menunggu':value==='approved'?'Disetujui':'Semua aktif'}</button>)}
      </div>
      {error&&<div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}
      {success&&<div role="status" className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0"/>{success}</div>}
      {loading?<div className="py-12 text-center text-xs text-slate-500">Memuat antrean bisnis...</div>:visibleRows.length===0?<div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-800">Tidak ada bisnis pada filter ini</p></div>:<div className="mt-5 space-y-4">
        {visibleRows.map((business)=>{
          const branchRows=locations.filter((location)=>location.business_id===business.id);
          const events=history.filter((event)=>event.business_id===business.id);
          const isPending=business.review_status==='pending_review';
          const isApproved=business.review_status==='approved';
          return <article key={business.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{business.business_category||'Kategori belum diisi'}</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{business.business_name}</h2><p className="mt-1 text-[10px] text-slate-500">Dibuat {new Date(business.created_at).toLocaleString('id-ID')}</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-800">{statusLabel[business.review_status]||business.review_status}</span></div>
            <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-600">{business.description||'Belum ada deskripsi bisnis.'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600">{business.public_phone&&<span className="rounded-full bg-slate-100 px-2.5 py-1">Kontak: {business.public_phone}</span>}{business.website_url&&<span className="rounded-full bg-slate-100 px-2.5 py-1">{business.website_url}</span>}</div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-800"><MapPin className="h-4 w-4 text-violet-700"/> Lokasi usaha ({branchRows.length})</div>{branchRows.map((location)=><div key={location.id} className="border-t border-slate-200 py-2 text-[11px]"><p className="font-bold text-slate-800">{location.location_name} {location.is_active?'':'· nonaktif'}</p><p className="mt-0.5 text-slate-600">{location.address_text}{location.city?`, ${location.city}`:''}{location.province?`, ${location.province}`:''}</p>{location.public_phone&&<p className="text-slate-500">{location.public_phone}</p>}</div>)}</div>
            {events.length>0&&<div className="mt-3 rounded-xl border border-slate-100 p-3"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Riwayat keputusan</p><ol className="space-y-2">{events.map((event)=><li key={event.id} className="text-[10px]"><p className="font-bold text-slate-800">{statusLabel[event.from_status||'draft']||event.from_status||'Dibuat'} → {statusLabel[event.to_status]||event.to_status} · {new Date(event.created_at).toLocaleString('id-ID')}</p>{event.decision_note&&<p className="mt-0.5 text-slate-600">{event.decision_note}</p>}</li>)}</ol></div>}
            {(isPending||isApproved)&&<div className="mt-4 border-t border-slate-100 pt-4"><label className="block text-[10px] font-bold text-slate-700">{isPending?'Catatan keputusan / alasan revisi':'Catatan penonaktifan (wajib jika menonaktifkan)'}<textarea rows={2} maxLength={1200} value={notes[business.id]||''} onChange={(e)=>setNotes((old)=>({...old,[business.id]:e.target.value}))} placeholder="Tuliskan catatan yang jelas untuk pemilik bisnis..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label>
              <div className="mt-3 flex flex-wrap gap-2">{isPending&&<><button disabled={!!actingId||!historyReady||branchRows.filter((b)=>b.is_active).length===0} onClick={()=>void decide(business.id,'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-3 w-3"/> Setujui & publikasikan</button><button disabled={!!actingId||!historyReady||(notes[business.id]||'').trim().length<8} onClick={()=>void decide(business.id,'needs_revision')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-900 disabled:opacity-40">Minta revisi</button><button disabled={!!actingId||!historyReady||(notes[business.id]||'').trim().length<8} onClick={()=>void decide(business.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><XCircle className="mr-1 inline h-3 w-3"/> Tolak</button></>}
                {isApproved&&<button disabled={!!actingId||!historyReady||(notes[business.id]||'').trim().length<8} onClick={()=>void decide(business.id,'suspended')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800 disabled:opacity-40">Nonaktifkan bisnis</button>}</div>
            </div>}
            {actingId===business.id&&<p className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin"/> Menyimpan keputusan...</p>}
          </article>;
        })}
      </div>}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">Review Promo Merchant</h2><p className="mt-1 text-[11px] text-slate-500">Promo ditinjau terpisah dari profil bisnis dan hanya tampil jika keduanya disetujui.</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-800">{offerRows.filter((offer)=>offer.status==='pending_review').length} menunggu</span></div>
        {offerLoading?<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Memuat antrean promo...</div>:offerRows.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Belum ada promo yang menunggu review atau sedang tayang.</div>:<div className="space-y-3">{offerRows.map((offer)=>{
          const events=offerHistory.filter((event)=>event.offer_id===offer.id);
          const pending=offer.status==='pending_review';
          const approved=offer.status==='approved';
          return <article key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">{offer.business_name} · {offer.offer_type}</p><h3 className="mt-1 text-sm font-extrabold text-slate-900">{offer.title}</h3></div><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-bold text-violet-800">{statusLabel[offer.status]||offer.status}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{offer.description}</p>
            {offer.eligibility&&<p className="mt-1 text-[10px] text-slate-500">Syarat peserta: {offer.eligibility}</p>}
            <p className="mt-1 text-[10px] text-slate-500">{offer.quota ? 'Kuota: '+offer.quota : 'Kuota: tidak dibatasi'} · Ditanggung merchant</p>
            {offer.ends_at&&<p className="mt-1 text-[10px] text-slate-500">Berakhir {new Date(offer.ends_at).toLocaleString('id-ID')}</p>}
            {offer.terms&&<p className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] leading-5 text-slate-600">Syarat: {offer.terms}</p>}
            {offer.redemption_instructions&&<p className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] leading-5 text-slate-600">Penukaran: {offer.redemption_instructions}</p>}
            {events.length>0&&<div className="mt-3 border-t border-slate-100 pt-3"><p className="mb-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Riwayat promo</p>{events.map((event)=><p key={event.id} className="mt-1 text-[10px] text-slate-600">{statusLabel[event.from_status||'draft']||event.from_status||'Draft'} → {statusLabel[event.to_status]||event.to_status} · {new Date(event.created_at).toLocaleString('id-ID')}{event.decision_note?' — '+event.decision_note:''}</p>)}</div>}
            {(pending||approved)&&<div className="mt-3 border-t border-slate-100 pt-3"><label className="block text-[10px] font-bold text-slate-700">Catatan keputusan<textarea rows={2} maxLength={1200} value={offerNotes[offer.id]||''} onChange={(e)=>setOfferNotes((old)=>({...old,[offer.id]:e.target.value}))} placeholder="Catatan yang akan diterima pemilik bisnis..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label><div className="mt-2 flex flex-wrap gap-2">{pending&&<><button disabled={!!actingOfferId||!offerHistoryReady} onClick={()=>void decideOffer(offer.id,'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">Setujui promo</button><button disabled={!!actingOfferId||!offerHistoryReady||(offerNotes[offer.id]||'').trim().length<8} onClick={()=>void decideOffer(offer.id,'needs_revision')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-900 disabled:opacity-40">Minta revisi</button><button disabled={!!actingOfferId||!offerHistoryReady||(offerNotes[offer.id]||'').trim().length<8} onClick={()=>void decideOffer(offer.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">Tolak</button></>}{approved&&<button disabled={!!actingOfferId||!offerHistoryReady||(offerNotes[offer.id]||'').trim().length<8} onClick={()=>void decideOffer(offer.id,'suspended')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800 disabled:opacity-40">Nonaktifkan promo</button>}</div></div>}
            {actingOfferId===offer.id&&<p className="mt-2 text-[10px] text-slate-500">Menyimpan keputusan...</p>}
          </article>;
        })}</div>}
      </section>
      <p className="mt-5 text-[10px] leading-5 text-slate-500">Akses review dibatasi ke Super Admin pada tahap awal. Semua keputusan melalui RPC server dan dicatat pada riwayat audit. Bisnis hanya tampil publik setelah disetujui.</p>
    </div>
  </main>;
};
