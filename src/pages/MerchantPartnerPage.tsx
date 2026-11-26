import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, MapPin, Search, Store, Phone, Globe2, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppRoute } from '../types/navigation';

interface Props { onNavigate: (path: AppRoute) => void; }
interface MerchantBusiness {
  id: string;
  business_name: string;
  description: string | null;
  business_category: string | null;
  public_phone: string | null;
  website_url: string | null;
  review_status: string;
}
interface MerchantLocation {
  id: string;
  business_id: string;
  location_name: string;
  address_text: string;
  city: string | null;
  province: string | null;
  public_phone: string | null;
  opening_hours: Record<string,unknown>;
}
interface MerchantCard extends MerchantBusiness { locations: MerchantLocation[]; }

export const MerchantPartnerPage: React.FC<Props> = ({ onNavigate }) => {
  const [businesses,setBusinesses]=useState<MerchantCard[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const selected=businesses.find((item)=>item.id===selectedId)||null;

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      setLoading(true);setError('');
      const {data,error:businessError}=await supabase.from('merchant_businesses')
        .select('id,business_name,description,business_category,public_phone,website_url,review_status')
        .eq('review_status','approved').order('business_name',{ascending:true}).limit(100);
      if(businessError){if(mounted){setError('Direktori Merchant Partner belum aktif. Data bisnis akan tampil setelah fondasi Merchant Partner diterapkan dan bisnis pertama disetujui.');setBusinesses([]);setLoading(false);}return;}
      const rows=(data||[]) as MerchantBusiness[];
      const ids=rows.map((item)=>item.id);
      const {data:locationRows,error:locationError}=ids.length
        ? await supabase.from('merchant_locations').select('id,business_id,location_name,address_text,city,province,public_phone,opening_hours').in('business_id',ids).eq('is_active',true).order('location_name',{ascending:true})
        : {data:[] as any[],error:null};
      if(!mounted)return;
      if(locationError){setError('Lokasi merchant belum dapat dimuat. Coba muat ulang.');setBusinesses([]);setLoading(false);return;}
      const grouped=new Map<string,MerchantLocation[]>();
      (locationRows||[]).forEach((location:MerchantLocation)=>grouped.set(location.business_id,[...(grouped.get(location.business_id)||[]),location]));
      const cards=rows.map((business)=>({...business,locations:grouped.get(business.id)||[]})).filter((business)=>business.locations.length>0);
      setBusinesses(cards);
      setSelectedId((current)=>cards.some((item)=>item.id===current)?current:(cards[0]?.id||''));
      setLoading(false);
    };
    void load();
    return()=>{mounted=false;};
  },[]);

  const visible=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase('id');
    if(!normalized)return businesses;
    return businesses.filter((business)=>[
      business.business_name,business.business_category||'',business.description||'',
      ...business.locations.flatMap((location)=>[location.location_name,location.city||'',location.province||'',location.address_text]),
    ].join(' ').toLocaleLowerCase('id').includes(normalized));
  },[businesses,query]);

  const safeWebsite=(url:string|null)=>{
    if(!url)return null;
    try{const parsed=new URL(url);return parsed.protocol==='https:'||parsed.protocol==='http:'?parsed.toString():null;}catch{return null;}
  };

  return <main className="min-h-[70vh] bg-[radial-gradient(circle_at_top_left,_rgba(233,213,255,0.55),_transparent_32%),linear-gradient(180deg,#faf8ff_0%,#fff_48%)] px-4 py-7 sm:py-10">
    <div className="mx-auto max-w-6xl">
      <button onClick={()=>onNavigate('/talent')} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-purple-800"><ArrowLeft className="h-4 w-4"/> Kembali ke Jelajah</button>
      <header className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#21103D] via-[#45206F] to-[#741C70] p-5 text-white shadow-xl sm:p-8">
        <div className="flex items-start gap-4"><span className="rounded-2xl border border-white/15 bg-white/10 p-3"><Store className="h-7 w-7 text-fuchsia-200"/></span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">YUKU Business Ecosystem</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Merchant Partner</h1><p className="mt-2 max-w-2xl text-xs leading-6 text-purple-100 sm:text-sm">Temukan bisnis, tempat aktivitas, dan merchant lokal yang telah diverifikasi YUKU. Hubungi merchant atau kunjungi lokasinya secara langsung.</p></div></div>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold text-purple-100"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Bisnis terverifikasi</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Multi-lokasi</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Bayar langsung ke merchant</span></div>
      </header>
      <label className="mb-5 flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3 shadow-sm"><Search className="h-4 w-4 shrink-0 text-purple-700"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari nama bisnis, kategori, atau kota..." className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"/></label>
      {error&&<div role="alert" className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}
      {loading?<div className="py-14 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin"/>Memuat merchant...</div>:visible.length===0?<div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center"><Building2 className="mx-auto h-9 w-9 text-slate-300"/><h2 className="mt-3 text-base font-extrabold text-slate-800">{businesses.length===0?'Merchant Partner segera hadir':'Bisnis tidak ditemukan'}</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{businesses.length===0?'Saat ini belum ada bisnis yang disetujui untuk ditampilkan. Kembali lagi setelah partner pertama aktif.':'Coba kata kunci lain atau nama kota yang berbeda.'}</p><button onClick={()=>onNavigate('/merchant-center')} className="mt-5 rounded-xl bg-purple-800 px-4 py-2.5 text-xs font-bold text-white">Daftarkan bisnis Anda</button></div>:<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-slate-900">Bisnis terverifikasi</h2><span className="text-[10px] font-semibold text-slate-500">{visible.length} bisnis</span></div>
          {visible.map((business)=><button key={business.id} onClick={()=>setSelectedId(business.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId===business.id?'border-purple-400 bg-purple-50 shadow-sm':'border-slate-200 bg-white hover:border-purple-200'}`}>
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-purple-100 p-2.5 text-purple-800"><Store className="h-5 w-5"/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-purple-700">{business.business_category||'Merchant Partner'}</p><h3 className="mt-1 truncate text-sm font-extrabold text-slate-900">{business.business_name}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{business.description||'Bisnis partner YUKU'}</p></div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400"/></div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><MapPin className="h-3.5 w-3.5 text-purple-700"/>{business.locations.length} lokasi · {Array.from(new Set(business.locations.map((location)=>location.city).filter(Boolean))).slice(0,2).join(', ')||'Lokasi terdaftar'}</div>
          </button>)}
        </section>
        <aside className="h-fit rounded-2xl border border-purple-100 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          {selected?<><p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Merchant Partner terverifikasi</p><h2 className="mt-1 text-xl font-black text-slate-900">{selected.business_name}</h2><p className="mt-2 text-xs leading-6 text-slate-600">{selected.description||'Informasi bisnis belum ditambahkan.'}</p>
            <div className="mt-4 space-y-3">{selected.locations.map((location)=><div key={location.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-extrabold text-slate-800">{location.location_name}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{location.address_text}{location.city?`, ${location.city}`:''}{location.province?`, ${location.province}`:''}</p>{typeof location.opening_hours?.display === 'string' && <p className="mt-1 text-[10px] text-slate-500">Jam operasional: {location.opening_hours.display}</p>}{location.public_phone&&<a href={`tel:${location.public_phone}`} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-800"><Phone className="h-3 w-3"/> {location.public_phone}</a>}</div>)}</div>
            <div className="mt-4 flex flex-wrap gap-2">{selected.public_phone&&<a href={`tel:${selected.public_phone}`} className="inline-flex items-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-xs font-bold text-white"><Phone className="h-3.5 w-3.5"/> Hubungi bisnis</a>}{safeWebsite(selected.website_url)&&<a href={safeWebsite(selected.website_url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-purple-200 px-4 py-2.5 text-xs font-bold text-purple-800"><Globe2 className="h-3.5 w-3.5"/> Website</a>}</div>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">Pembayaran dan transaksi dilakukan langsung dengan merchant. YUKU tidak memproses checkout merchant pada tahap ini.</p>
          </>:<div className="py-8 text-center"><Store className="mx-auto h-8 w-8 text-purple-200"/><p className="mt-3 text-xs font-semibold text-slate-600">Pilih bisnis untuk melihat detail dan lokasi</p></div>}
        </aside>
      </div>}
    </div>
  </main>;
};
