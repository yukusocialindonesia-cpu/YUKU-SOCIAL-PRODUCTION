import React from 'react';
import {
  Bell, Search, MapPin, MessageCircle, Gamepad2, Coffee, Plane,
  Ticket, ShoppingBag, Sparkles, Home, Compass, Plus, MessageSquare, UserRound,
  Star, BadgeCheck, Clock3, ArrowRight, Heart,
} from 'lucide-react';

const categories = [
  { label: 'Ngobrol', icon: MessageCircle, color: 'bg-violet-100 text-violet-700' },
  { label: 'Gaming', icon: Gamepad2, color: 'bg-blue-100 text-blue-700' },
  { label: 'Kuliner', icon: Coffee, color: 'bg-orange-100 text-orange-700' },
  { label: 'Travel', icon: Plane, color: 'bg-cyan-100 text-cyan-700' },
  { label: 'Event', icon: Ticket, color: 'bg-pink-100 text-pink-700' },
  { label: 'Belanja', icon: ShoppingBag, color: 'bg-amber-100 text-amber-700' },
  { label: 'Olahraga', icon: Sparkles, color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Lainnya', icon: Plus, color: 'bg-slate-100 text-slate-700' },
];

const talents = [
  { name: 'Nadia', city: 'Bogor', activity: 'Teman ngobrol', price: 'Rp75rb/jam', rating: '4.9', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80', available: true },
  { name: 'Raka', city: 'Jakarta', activity: 'Gaming partner', price: 'Rp60rb/jam', rating: '4.8', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80', available: true },
  { name: 'Alya', city: 'Depok', activity: 'Kuliner & cafe', price: 'Rp80rb/jam', rating: '5.0', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80', available: false },
];

export const MobileHomePrototypePage: React.FC = () => (
  <div className="min-h-screen bg-[#faf8ff] text-slate-900 pb-24">
    <div className="mx-auto max-w-[480px] overflow-hidden bg-white min-h-screen shadow-xl">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <div className="text-[26px] font-black tracking-tight text-violet-700">YUKU<span className="text-pink-500">.</span></div>
          <div className="text-[10px] -mt-1 tracking-[.18em] text-slate-400 font-semibold">REAL FRIENDS. REAL MOMENTS.</div>
        </div>
        <button aria-label="Notifikasi" className="relative h-10 w-10 rounded-full bg-violet-50 grid place-items-center text-violet-700">
          <Bell size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white"/>
        </button>
      </div>

      <div className="px-4">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#38106c] via-[#7724a7] to-[#e14b91] p-5 text-white min-h-[206px]">
          <div className="absolute -right-10 -top-8 h-44 w-44 rounded-full bg-white/10"/>
          <div className="absolute right-3 bottom-0 h-36 w-32 rounded-t-full bg-gradient-to-t from-amber-200/70 to-pink-100/20 blur-[1px]"/>
          <div className="relative z-10 max-w-[245px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold tracking-wide"><Sparkles size={12}/> TEMUKAN TEMAN AKTIVITASMU</span>
            <h1 className="mt-3 text-[27px] leading-[1.08] font-extrabold">Lebih dekat,<br/>lebih seru!</h1>
            <p className="mt-2 text-[12px] leading-relaxed text-white/85">Temukan teman nyata untuk ngobrol, jalan, dan mencoba hal baru.</p>
            <button className="mt-4 rounded-full bg-white px-4 py-2 text-[11px] font-extrabold text-violet-800 shadow-lg">Jelajahi sekarang <ArrowRight className="inline ml-1" size={13}/></button>
          </div>
          <div className="absolute right-3 bottom-4 text-[58px] drop-shadow-lg" aria-hidden="true">🤝</div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-white"/><span className="h-1.5 w-1.5 rounded-full bg-white/50"/><span className="h-1.5 w-1.5 rounded-full bg-white/50"/>
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_8px_25px_rgba(76,29,149,.07)]">
          <div className="flex items-center gap-2">
            <Search className="text-violet-500" size={18}/>
            <span className="text-sm text-slate-400">Mau melakukan aktivitas apa?</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-600"><MapPin size={15} className="text-pink-500"/> Semua kota</div>
            <button className="rounded-xl bg-gradient-to-r from-violet-700 to-pink-500 px-5 py-2 text-xs font-bold text-white">Cari teman</button>
          </div>
        </div>
      </div>

      <section className="mt-6 px-5">
        <div className="flex items-end justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-pink-500">Pilih aktivitas</p><h2 className="mt-1 text-lg font-extrabold">Mau seru-seruan apa?</h2></div>
          <button className="text-xs font-bold text-violet-700">Lihat semua</button>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
          {categories.map(({label, icon: Icon, color}) => <button key={label} className="flex flex-col items-center gap-2">
            <span className={`grid h-[54px] w-[54px] place-items-center rounded-[19px] ${color} shadow-sm`}><Icon size={23}/></span>
            <span className="text-[10px] font-semibold text-slate-600">{label}</span>
          </button>)}
        </div>
      </section>

      <section className="mt-7">
        <div className="px-5 flex items-end justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-pink-500">Pilihan untukmu</p><h2 className="mt-1 text-lg font-extrabold">Talent pilihan ✨</h2><p className="text-[11px] text-slate-400">Temukan partner untuk aktivitas berikutnya</p></div>
          <button className="pb-1 text-xs font-bold text-violet-700">Lihat semua</button>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
          {talents.map(t => <article key={t.name} className="w-[172px] shrink-0 overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_7px_22px_rgba(15,23,42,.07)]">
            <div className="relative h-[150px]">
              <img src={t.image} alt={`Contoh foto profil ${t.name}`} className="h-full w-full object-cover"/>
              <button aria-label="Simpan talent" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-pink-500"><Heart size={16}/></button>
              <span className={`absolute bottom-2 left-2 rounded-full px-2 py-1 text-[9px] font-bold text-white ${t.available ? 'bg-emerald-500' : 'bg-slate-500'}`}>{t.available ? '● Tersedia' : 'Jadwal terbatas'}</span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-1"><h3 className="text-sm font-extrabold">{t.name}</h3><BadgeCheck size={14} className="text-blue-500"/></div>
              <p className="mt-1 text-[10px] text-slate-500">{t.activity}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><MapPin size={11}/>{t.city}<span className="ml-auto flex items-center gap-1 font-bold text-amber-500"><Star size={11} fill="currentColor"/>{t.rating}</span></p>
              <p className="mt-2 text-xs font-extrabold text-violet-700">{t.price}</p>
            </div>
          </article>)}
        </div>
      </section>

      <section className="mt-6 px-5">
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#48117d] to-[#c02b86] p-4 text-white">
          <div className="absolute -right-4 -top-6 text-7xl opacity-20">🎉</div>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-pink-200">Jadi bagian dari YUKU</p>
          <h2 className="mt-1 max-w-[230px] text-lg font-extrabold leading-tight">Punya waktu dan hobi seru? Bagikan bersama!</h2>
          <button className="mt-3 rounded-full bg-white px-4 py-2 text-[10px] font-extrabold text-violet-800">Daftar jadi talent <ArrowRight className="inline ml-1" size={12}/></button>
        </div>
      </section>

      <section className="mt-6 px-5 pb-5">
        <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">Kenapa YUKU?</h2><span className="text-[10px] font-semibold text-violet-600">Aman & nyaman</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-violet-50 p-3"><BadgeCheck className="text-violet-600" size={19}/><p className="mt-2 text-[10px] font-bold">Profil terverifikasi</p></div>
          <div className="rounded-2xl bg-pink-50 p-3"><Heart className="text-pink-600" size={19}/><p className="mt-2 text-[10px] font-bold">Aktivitas positif</p></div>
          <div className="rounded-2xl bg-amber-50 p-3"><Clock3 className="text-amber-600" size={19}/><p className="mt-2 text-[10px] font-bold">Atur jadwalmu</p></div>
        </div>
      </section>

      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[480px] -translate-x-1/2 items-center justify-around border-t border-slate-100 bg-white/95 px-3 py-3 backdrop-blur">
        <div className="flex flex-col items-center gap-1 text-violet-700"><Home size={19}/><span className="text-[9px] font-bold">Beranda</span></div>
        <div className="flex flex-col items-center gap-1 text-slate-400"><Compass size={19}/><span className="text-[9px]">Eksplorasi</span></div>
        <div className="-mt-7 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-700 to-pink-500 text-white shadow-lg shadow-violet-300"><Plus size={23}/></div>
        <div className="flex flex-col items-center gap-1 text-slate-400"><MessageSquare size={19}/><span className="text-[9px]">Chat</span></div>
        <div className="flex flex-col items-center gap-1 text-slate-400"><UserRound size={19}/><span className="text-[9px]">Profil</span></div>
      </nav>

      <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
        <strong>MODE PROTOTYPE:</strong> Profil, foto, harga, rating, dan status di halaman ini hanya data contoh. Tidak terhubung ke database atau fitur transaksi.
      </div>
    </div>
  </div>
);
