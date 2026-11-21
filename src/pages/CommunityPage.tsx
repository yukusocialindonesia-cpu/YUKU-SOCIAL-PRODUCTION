import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Hash,
  Heart,
  ImagePlus,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { AppRoute } from '../types/navigation';

type DemoPost = {
  id: number;
  name: string;
  handle: string;
  time: string;
  text: string;
  topic: string;
  likes: number;
  comments: number;
  initials: string;
  tone: string;
};

type CommunityPageProps = {
  onNavigate: (path: AppRoute) => void;
};

const topics = ['Pertemanan', 'Kuliner', 'Travel & Aktivitas', 'Hobi', 'Gaming'];

const starterPosts: DemoPost[] = [
  {
    id: 1,
    name: 'Nadia Putri',
    handle: '@nadiaputri',
    time: '12 menit lalu',
    text: 'Lagi cari teman untuk eksplor coffee shop baru di Bogor akhir pekan ini. Ada rekomendasi tempat yang nyaman?',
    topic: 'Kuliner',
    likes: 24,
    comments: 8,
    initials: 'NP',
    tone: 'from-fuchsia-500 to-purple-700',
  },
  {
    id: 2,
    name: 'Rizky A.',
    handle: '@rizkyjalan',
    time: '38 menit lalu',
    text: 'Siapa yang suka jalan pagi dan menikmati suasana alam? Yuk saling berbagi tempat favorit!',
    topic: 'Travel & Aktivitas',
    likes: 17,
    comments: 4,
    initials: 'RA',
    tone: 'from-amber-400 to-orange-600',
  },
  {
    id: 3,
    name: 'Maya Lestari',
    handle: '@mayalestari',
    time: '1 jam lalu',
    text: 'Menurut kalian, aktivitas seru apa yang cocok dilakukan bareng teman baru saat akhir pekan?',
    topic: 'Pertemanan',
    likes: 31,
    comments: 12,
    initials: 'ML',
    tone: 'from-sky-500 to-indigo-700',
  },
];

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

    setPosts((current) => [
      {
        id: Date.now(),
        name: 'Kamu',
        handle: '@akun-yuku',
        time: 'Baru saja',
        text,
        topic: draftTopic,
        likes: 0,
        comments: 0,
        initials: 'YK',
        tone: 'from-purple-700 to-fuchsia-600',
      },
      ...current,
    ]);
    setDraft('');
    setActiveTopic('Semua');
  };

  const publishDemoComment = (postId: number) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;

    setComments((current) => ({ ...current, [postId]: [...(current[postId] || []), text] }));
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, comments: post.comments + 1 } : post)),
    );
    setCommentDrafts((current) => ({ ...current, [postId]: '' }));
  };

  return (
    <div className="min-h-screen bg-[#FAF8FC] pb-8">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e0938] via-[#38105f] to-[#68164f] text-white">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-7 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between md:py-12 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-purple-50 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              RUANG KOMUNITAS YUKU
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Temukan teman.
              <span className="block bg-gradient-to-r from-fuchsia-200 via-pink-200 to-amber-200 bg-clip-text text-transparent">
                Mulai cerita baru.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-purple-100 sm:text-base">
              Berbagi minat, ngobrol dengan orang baru, dan temukan aktivitas seru bersama komunitas YUKU.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/90">
                <Users className="h-3.5 w-3.5" /> Kenalan dengan komunitas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/90">
                <ShieldCheck className="h-3.5 w-3.5" /> Ruang yang saling menghargai
              </span>
            </div>
          </div>
          <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl backdrop-blur-md md:max-w-xs md:p-5">
            <p className="text-xs font-semibold text-purple-100">Dari obrolan sederhana...</p>
            <p className="mt-1 text-lg font-extrabold leading-snug">bisa jadi aktivitas yang berkesan.</p>
            <div className="my-4 h-px bg-white/15" />
            <p className="text-xs leading-5 text-purple-100">
              Temukan talent dan aktivitas yang cocok, lalu lakukan booking dengan aman melalui YUKU.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/talent')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-purple-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-50"
            >
              Jelajahi talent <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0">
            <section className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-fuchsia-600 text-xs font-black text-white shadow-sm">
                  YK
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-slate-900">Apa ceritamu hari ini?</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">Bagikan ide, cerita, atau rencana aktivitas.</p>
                </div>
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Tulis sesuatu yang ingin kamu bagikan..."
                rows={3}
                className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-[#FAF8FC] p-3.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500" htmlFor="community-topic">Topik</label>
                  <select
                    id="community-topic"
                    value={draftTopic}
                    onChange={(event) => setDraftTopic(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                  >
                    {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                  </select>
                  <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:inline-flex">
                    <ImagePlus className="h-4 w-4" /> Foto menyusul
                  </span>
                </div>
                <button
                  type="button"
                  onClick={publishDemoPost}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" /> Bagikan
                </button>
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                Pratinjau: postingan dan komentar di halaman ini masih berupa contoh lokal, belum tersimpan ke akun atau server.
              </p>
            </section>

            <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-700">Temukan obrolan</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Cerita dari komunitas</h2>
                <p className="mt-1 text-xs text-slate-500">Pilih topik yang paling dekat dengan minatmu.</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/talent')}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-800 transition hover:text-fuchsia-700"
              >
                Cari teman <Search className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
              {['Semua', ...topics].map((topic) => {
                const active = activeTopic === topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setActiveTopic(topic)}
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-[11px] font-bold transition ${active
                      ? 'border-purple-700 bg-purple-700 text-white shadow-sm'
                      : 'border-purple-100 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-800'}`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 space-y-4">
              {visiblePosts.map((post) => {
                const isLiked = liked.includes(post.id);
                const postComments = comments[post.id] || [];
                return (
                  <article key={post.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-purple-100 hover:shadow-md sm:rounded-3xl sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${post.tone} text-xs font-black text-white ring-4 ring-purple-50`}>
                        {post.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-slate-900">{post.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{post.handle} <span className="px-1 text-slate-300">·</span> {post.time}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-bold text-purple-800">{post.topic}</span>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.text}</p>
                    <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setLiked((current) => isLiked ? current.filter((id) => id !== post.id) : [...current, post.id])}
                        aria-pressed={isLiked}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${isLiked ? 'text-fuchsia-700' : 'text-slate-500 hover:text-fuchsia-700'}`}
                      >
                        <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} /> {post.likes + (isLiked ? 1 : 0)} Suka
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenComments((current) => current === post.id ? null : post.id)}
                        aria-expanded={openComments === post.id}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-purple-700"
                      >
                        <MessageCircle className="h-4 w-4" /> {post.comments} Komentar
                      </button>
                    </div>
                    {openComments === post.id && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="space-y-2">
                          {postComments.map((comment, index) => (
                            <p key={index} className="rounded-xl bg-[#FAF8FC] px-3 py-2.5 text-xs leading-5 text-slate-600">
                              <span className="font-extrabold text-slate-800">{index < 2 ? 'Anggota YUKU' : 'Kamu'}: </span>{comment}
                            </p>
                          ))}
                          {postComments.length === 0 && <p className="text-xs text-slate-400">Belum ada komentar. Jadilah yang pertama.</p>}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            value={commentDrafts[post.id] || ''}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                            onKeyDown={(event) => { if (event.key === 'Enter') publishDemoComment(post.id); }}
                            placeholder="Tulis komentar..."
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                          />
                          <button
                            type="button"
                            onClick={() => publishDemoComment(post.id)}
                            disabled={!(commentDrafts[post.id] || '').trim()}
                            className="rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-purple-800 disabled:opacity-40"
                          >
                            Kirim
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {visiblePosts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-purple-200 bg-white p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700"><Hash className="h-5 w-5" /></div>
                  <p className="mt-3 text-sm font-bold text-slate-800">Belum ada cerita di topik ini</p>
                  <p className="mt-1 text-xs text-slate-500">Jadilah orang pertama yang memulai obrolan.</p>
                </div>
              )}
            </div>
          </main>

          <aside className="hidden space-y-4 lg:block">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Jelajahi topik</h3>
                <Hash className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Pilih ruang obrolan sesuai minatmu.</p>
              <div className="mt-3 space-y-1">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setActiveTopic(topic)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-purple-50 hover:text-purple-800"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600"><Hash className="h-3.5 w-3.5" /></span>
                    {topic}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
                  </button>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-purple-700 shadow-sm"><Users className="h-5 w-5" /></div>
              <h3 className="mt-3 text-sm font-extrabold text-slate-900">Dari kenalan ke aktivitas</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Temukan talent, pilih aktivitas yang kamu suka, lalu lakukan booking melalui sistem YUKU.</p>
              <button
                type="button"
                onClick={() => onNavigate('/talent')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
              >
                Lihat talent <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </section>

            <section className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm"><ShieldCheck className="h-5 w-5" /></div>
              <h3 className="mt-3 text-sm font-extrabold text-slate-900">Jaga ruang tetap positif</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Hormati anggota lain, hindari spam, dan bagikan konten yang aman serta relevan.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};
