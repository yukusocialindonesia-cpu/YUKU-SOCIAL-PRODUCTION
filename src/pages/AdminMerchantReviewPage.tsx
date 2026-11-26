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

  const load = useCallback(async () => {
    setLoading(true); setError('');
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
    if(!ids.length){setLocations([]);setHistory([]);setLoading(false);return;}
    const [{data:locationRows,error:locationError},{data:historyRows,error:historyError}]=await Promise.all([
      supabase.from('merchant_locations').select('id,business_id,location_name,address_text,city,province,public_phone,is_active').in('business_id',ids).order('created_at',{ascending:true}),
      supabase.from('merchant_business_review_history').select('id,business_id,from_status,to_status,decision_note,actor_role,created_at').in('business_id',ids).order('created_at',{ascending:false}),
    ]);
    if(locationError) setError('Profil bisnis terbaca, tetapi daftar lokasi gagal dimuat.');
    if(historyError) setError('Riwayat audit gagal dimuat. Jangan mengambil keputusan sampai riwayat dapat diperiksa.');
    setLocations((locationRows||[]) as LocationRow[]);
    setHistory((historyRows||[]) as HistoryRow[]);
    setLoading(false);
  },[filter]);

  useEffect(()=>{
    if(isAuthLoading)return;
    const allowed=role==='admin' && adminAccess?.isSuperAdmin===true;
    setAuthorized(allowed);
    if(allowed) void load(); else setLoading(false);
  },[role,adminAccess,isAuthLoading,load]);

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
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-200">YUKU Admin · Merchant Partner</p><h1 className="mt-1 text-2xl font-black">Review Bisnis</h1><p className="mt-2 text-xs text-violet-100">Periksa profil dan lokasi sebelum bisnis dipublikasikan.</p></div><button onClick={()=>void load()} disabled={loading} aria-label="Muat ulang antrean" className="rounded-xl bg-white/15 p-3"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div>
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
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{business.business_category||'Kategori belum diisi'}</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{business.business_name}</h2><p className="mt-1 text-[10px] text-slate-500">Diajukan {new Date(business.created_at).toLocaleString('id-ID')}</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-800">{statusLabel[business.review_status]||business.review_status}</span></div>
            <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-600">{business.description||'Belum ada deskripsi bisnis.'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600">{business.public_phone&&<span className="rounded-full bg-slate-100 px-2.5 py-1">Kontak: {business.public_phone}</span>}{business.website_url&&<span className="rounded-full bg-slate-100 px-2.5 py-1">{business.website_url}</span>}</div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-800"><MapPin className="h-4 w-4 text-violet-700"/> Lokasi usaha ({branchRows.length})</div>{branchRows.map((location)=><div key={location.id} className="border-t border-slate-200 py-2 text-[11px]"><p className="font-bold text-slate-800">{location.location_name} {location.is_active?'':'· nonaktif'}</p><p className="mt-0.5 text-slate-600">{location.address_text}{location.city?`, ${location.city}`:''}{location.province?`, ${location.province}`:''}</p>{location.public_phone&&<p className="text-slate-500">{location.public_phone}</p>}</div>)}</div>
            {events.length>0&&<div className="mt-3 rounded-xl border border-slate-100 p-3"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Riwayat keputusan</p><ol className="space-y-2">{events.map((event)=><li key={event.id} className="text-[10px]"><p className="font-bold text-slate-800">{statusLabel[event.from_status||'draft']||event.from_status||'Dibuat'} → {statusLabel[event.to_status]||event.to_status} · {new Date(event.created_at).toLocaleString('id-ID')}</p>{event.decision_note&&<p className="mt-0.5 text-slate-600">{event.decision_note}</p>}</li>)}</ol></div>}
            {(isPending||isApproved)&&<div className="mt-4 border-t border-slate-100 pt-4"><label className="block text-[10px] font-bold text-slate-700">{isPending?'Catatan keputusan / alasan revisi':'Catatan penonaktifan (wajib jika menonaktifkan)'}<textarea rows={2} maxLength={1200} value={notes[business.id]||''} onChange={(e)=>setNotes((old)=>({...old,[business.id]:e.target.value}))} placeholder="Tuliskan catatan yang jelas untuk pemilik bisnis..." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"/></label>
              <div className="mt-3 flex flex-wrap gap-2">{isPending&&<><button disabled={!!actingId||branchRows.filter((b)=>b.is_active).length===0} onClick={()=>void decide(business.id,'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-3 w-3"/> Setujui & publikasikan</button><button disabled={!!actingId||(notes[business.id]||'').trim().length<8} onClick={()=>void decide(business.id,'needs_revision')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-900 disabled:opacity-40">Minta revisi</button><button disabled={!!actingId||(notes[business.id]||'').trim().length<8} onClick={()=>void decide(business.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40"><XCircle className="mr-1 inline h-3 w-3"/> Tolak</button></>}
                {isApproved&&<button disabled={!!actingId||(notes[business.id]||'').trim().length<8} onClick={()=>void decide(business.id,'suspended')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800 disabled:opacity-40">Nonaktifkan bisnis</button>}</div>
            </div>}
            {actingId===business.id&&<p className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin"/> Menyimpan keputusan...</p>}
          </article>;
        })}
      </div>}
      <p className="mt-5 text-[10px] leading-5 text-slate-500">Akses review dibatasi ke Super Admin pada tahap awal. Semua keputusan melalui RPC server dan dicatat pada riwayat audit. Bisnis hanya tampil publik setelah disetujui.</p>
    </div>
  </main>;
};
