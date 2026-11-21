import React, { useState } from 'react';
import { Heart, MessageCircle, ImagePlus, Users, Compass, Hash, Plus, ShieldCheck, Send, Search, ArrowRight } from 'lucide-react';
import { AppRoute } from '../types/navigation';

type DemoPost = { id: number; name: string; handle: string; time: string; text: string; topic: string; likes: number; comments: number; initials: string; tone: string };

type CommunityPageProps = {
  onNavigate: (path: AppRoute) => void;
};

const starterPosts: DemoPost[] = [
  { id: 1, name: 'Nadia Putri', handle: '@nadiaputri', time: '12 menit lalu', text: 'Lagi cari teman untuk eksplor coffee shop baru di Bogor akhir pekan ini. Ada rekomendasi tempat yang nyaman?', topic: 'Kuliner', likes: 24, comments: 8, initials: 'NP', tone: 'from-fuchsia-500 to-purple-600' },
  { id: 2, name: 'Rizky A.', handle: '@rizkyjalan', time: '38 menit lalu', text: 'Siapa yang suka jalan pagi dan menikmati suasana alam? Yuk saling berbagi tempat favorit!', topic: 'Travel & Aktivitas', likes: 17, comments: 4, initials: 'RA', tone: 'from-amber-400 to-orange-500' },
  { id: 3, name: 'Maya Lestari', handle: '@mayalestari', time: '1 jam lalu', text: 'Menurut kalian, aktivitas seru apa yang cocok dilakukan bareng teman baru saat akhir pekan?', topic: 'Pertemanan', likes: 31, comments: 12, initials: 'ML', tone: 'from-sky-500 to-indigo-600' },
];

const topics = ['Pertemanan', 'Kuliner', 'Travel & Aktivitas', 'Hobi', 'Gaming'];

export const CommunityPage: React.FC<CommunityPageProps> = ({ onNavigate }) => {
  const [activeTopic, setActiveTopic] = useState('Semua');
  const [draft, setDraft] = useState('');
  const [draftTopic, setDraftTopic] = useState('Pertemanan');
  const [posts, setPosts] = useState(starterPosts);
  const [liked, setLiked] = useState<number[]>([]);
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string[]>>({
    1: ['Coba area Suryakencana, banyak pilihan menarik!', 'Aku juga tertarik ikut kalau jadi.'],
    2: ['Kebun Raya pagi-pagi selalu menyenangkan.'],
    3: ['Bisa coba kulineran atau board game bareng.'],
  });

  const visiblePosts = posts.filter((post) => activeTopic === 'Semua' || post.topic === activeTopic);

  const publishDemoPost = () => {
    const text = draft.trim();
    if (!text) return;
    setPosts((current) => [{
      id: Date.now(),
      name: 'Kamu',
      handle: '@akun-yuku',
      time: 'Baru saja',
      text,
      topic: draftTopic,
      likes: 0,
      comments: 0,
      initials: 'YK',
      tone: 'from-purple-600 to-fuchsia-500',
    }, ...current]);
    setDraft('');
    setActiveTopic('Semua');
  };

  const publishDemoComment = (postId: number) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    setComments((current) => ({ ...current, [postId]: [...(current[postId] || []), text] }));
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: post.comments + 1 } : post));
    setCommentDrafts((current) => ({ ...current, [postId]: '' }));
  };

  return (
    <div className="min-h-screen bg-[#FAF8FC]">
      <div className="bg-gradient-to-br from-purple-800 via-purple-700 to-fuchsia-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold mb-4"><Users className="w-4 h-4" /> YUKU COMMUNITY</div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">Temukan teman,<br className="sm:hidden" /> bagikan cerita.</h1>
            <p className="mt-3 text-sm sm:text-base text-purple-100 max-w-xl">Ruang untuk berbagi minat, menemukan aktivitas, dan membangun koneksi positif bersama komunitas YUKU.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2"><ShieldCheck className="w-4 h-4" /> Komunitas positif</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2"><Users className="w-4 h-4" /> Terbuka untuk semua pengguna</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <main className="min-w-0">
            <section className="bg-white border border-purple-100 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-extrabold">YK</div>
                <div><h2 className="font-bold text-slate-900 text-sm">Bagikan aktivitasmu</h2><p className="text-xs text-slate-500">Ceritakan sesuatu kepada komunitas</p></div>
              </div>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Apa yang ingin kamu ceritakan hari ini?" rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-[#FAF8FC] p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-500" htmlFor="community-topic">Topik</label>
                  <select id="community-topic" value={draftTopic} onChange={(event) => setDraftTopic(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300">
                    {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                  </select>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400"><ImagePlus className="w-4 h-4" /> Foto segera hadir</span>
                </div>
                <button onClick={publishDemoPost} disabled={!draft.trim()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-40"><Send className="w-3.5 h-3.5" /> Bagikan</button>
              </div>
              <p className="mt-3 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Mode prototype: postingan dan komentar hanya tersimpan sementara di halaman ini, belum dikirim ke server.</p>
            </section>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div><p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Ruang berbagi</p><h2 className="text-xl font-extrabold text-slate-900">Postingan komunitas</h2></div>
              <button onClick={() => onNavigate('/talent')} className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 hover:text-fuchsia-700"><Search className="w-4 h-4" /> Cari teman <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
              {['Semua', ...topics].map((topic) => <button key={topic} onClick={() => setActiveTopic(topic)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${activeTopic === topic ? 'bg-purple-700 border-purple-700 text-white' : 'bg-white border-purple-100 text-slate-600 hover:border-purple-300 hover:text-purple-800'}`}>{topic}</button>)}
            </div>

            <div className="mt-3 space-y-4">
              {visiblePosts.map((post) => {
                const isLiked = liked.includes(post.id);
                const postComments = comments[post.id] || [];
                return <article key={post.id} className="rounded-2xl border border-purple-100 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${post.tone} text-white flex items-center justify-center text-xs font-black`}>{post.initials}</div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{post.name}</p><p className="text-[11px] text-slate-500">{post.handle} · {post.time}</p></div>
                    <span className="rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-bold text-purple-800">{post.topic}</span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">{post.text}</p>
                  <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3">
                    <button onClick={() => setLiked((current) => isLiked ? current.filter((id) => id !== post.id) : [...current, post.id])} className={`inline-flex items-center gap-1.5 text-xs font-semibold ${isLiked ? 'text-fuchsia-700' : 'text-slate-500 hover:text-fuchsia-700'}`}><Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} /> {post.likes + (isLiked ? 1 : 0)} Suka</button>
                    <button onClick={() => setOpenComments((current) => current === post.id ? null : post.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-700"><MessageCircle className="w-4 h-4" /> {post.comments} Komentar</button>
                  </div>
                  {openComments === post.id && <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="space-y-2">
                      {postComments.map((comment, index) => <p key={index} className="rounded-lg bg-[#FAF8FC] px-3 py-2 text-xs text-slate-600"><span className="font-bold text-slate-800">{index < 2 ? 'Anggota YUKU' : 'Kamu'}: </span>{comment}</p>)}
                      {postComments.length === 0 && <p className="text-xs text-slate-400">Belum ada komentar. Jadilah yang pertama.</p>}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') publishDemoComment(post.id); }} placeholder="Tulis komentar..." className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                      <button onClick={() => publishDemoComment(post.id)} disabled={!(commentDrafts[post.id] || '').trim()} className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Kirim</button>
                    </div>
                  </div>}
                </article>;
              })}
              {visiblePosts.length === 0 && <div className="rounded-2xl border border-dashed border-purple-200 bg-white p-8 text-center text-sm text-slate-500">Belum ada postingan pada topik ini.</div>}
            </div>
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
              <h3 className="font-extrabold text-slate-900">Jelajahi topik</h3>
              <p className="mt-1 text-xs text-slate-500">Temukan obrolan sesuai minatmu.</p>
              <div className="mt-4 space-y-1">{topics.map((topic) => <button key={topic} onClick={() => setActiveTopic(topic)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-800"><Hash className="w-4 h-4 text-purple-500" /> {topic}<Plus className="ml-auto w-3.5 h-3.5" /></button>)}</div>
            </section>
            <section className="rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 p-5">
              <div className="w-10 h-10 rounded-xl bg-white text-purple-700 flex items-center justify-center shadow-sm"><Users className="w-5 h-5" /></div>
              <h3 className="mt-3 font-extrabold text-slate-900">Ingin menemukan teman?</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">Jelajahi profil talent, pilih aktivitas yang kamu suka, lalu lakukan booking dengan aman melalui YUKU.</p>
              <button onClick={() => onNavigate('/talent')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-800">Jelajahi talent <ArrowRight className="w-3.5 h-3.5" /></button>
            </section>
            <section className="rounded-2xl bg-gradient-to-br from-amber-50 to-fuchsia-50 border border-fuchsia-100 p-5">
              <div className="w-10 h-10 rounded-xl bg-white text-purple-700 flex items-center justify-center shadow-sm"><ShieldCheck className="w-5 h-5" /></div>
              <h3 className="mt-3 font-extrabold text-slate-900">Jaga ruang tetap positif</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">Hormati anggota lain, hindari spam, dan bagikan konten yang aman serta relevan.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};
