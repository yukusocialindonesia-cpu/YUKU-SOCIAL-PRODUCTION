import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Hash,
  Heart,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Flag,
  RefreshCw,
} from 'lucide-react';
import { AppRoute } from '../types/navigation';
import { useAuth } from '../contexts/AuthContext';
import type { CommunityPost, CommunityTopic } from '../services/communityService';
import {
  createCommunityComment,
  createCommunityPost,
  loadCommunityPosts,
  reportCommunityPost,
  reportCommunityComment,
  toggleCommunityLike,
} from '../services/communityService';

type CommunityPageProps = {
  onNavigate: (path: AppRoute) => void;
};

const topics: CommunityTopic[] = ['Pertemanan', 'Kuliner', 'Travel & Aktivitas', 'Hobi', 'Gaming'];
const reportReasons = ['Spam', 'Pelecehan', 'Konten tidak pantas', 'Penipuan', 'Lainnya'];

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const CommunityPage: React.FC<CommunityPageProps> = ({ onNavigate }) => {
  const { user, isAuthLoading, isAuthenticated } = useAuth();
  const [activeTopic, setActiveTopic] = useState('Semua');
  const [draft, setDraft] = useState('');
  const [draftTopic, setDraftTopic] = useState<CommunityTopic>('Pertemanan');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyLikeIds, setBusyLikeIds] = useState<string[]>([]);
  const [busyCommentPostIds, setBusyCommentPostIds] = useState<string[]>([]);
  const [busyReportPostIds, setBusyReportPostIds] = useState<string[]>([]);
  const [busyReportCommentIds, setBusyReportCommentIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReasonsByPost, setReportReasonsByPost] = useState<Record<string, string>>({});
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReasonsByComment, setReportReasonsByComment] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const refreshPosts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const rows = await loadCommunityPosts(user?.id || null);
      setPosts(rows);
    } catch (error) {
      console.error('YUKU Community: gagal memuat postingan', error);
      setErrorMessage('Komunitas belum dapat dimuat. Silakan coba lagi beberapa saat.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshPosts();
  }, [refreshPosts]);

  const requireLogin = () => {
    if (!isAuthenticated) {
      onNavigate('/login');
      return false;
    }
    return true;
  };

  const publishPost = async () => {
    if (!requireLogin() || !user) return;
    const body = draft.trim();
    if (!body || body.length > 1200) return;

    setIsSubmitting(true);
    setNotice('');
    try {
      await createCommunityPost(user.id, body, draftTopic);
      setDraft('');
      setActiveTopic('Semua');
      setNotice('Postingan berhasil dibagikan.');
      await refreshPosts();
    } catch (error) {
      console.error('YUKU Community: gagal membuat postingan', error);
      const code = (error as { code?: string })?.code;
      setNotice(code === 'P0001'
        ? 'Kamu terlalu sering mengirim aktivitas. Coba lagi nanti.'
        : 'Postingan belum berhasil dikirim. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (post: CommunityPost) => {
    if (!requireLogin() || !user || busyLikeIds.includes(post.id)) return;
    setBusyLikeIds((current) => [...current, post.id]);
    try {
      await toggleCommunityLike(post.id, user.id, post.likedByMe);
      await refreshPosts();
    } catch (error) {
      console.error('YUKU Community: gagal mengubah suka', error);
      const code = (error as { code?: string })?.code;
      setNotice(code === 'P0001'
        ? 'Batas aktivitas suka tercapai. Coba lagi nanti.'
        : 'Belum berhasil memberi suka. Coba lagi.');
    } finally {
      setBusyLikeIds((current) => current.filter((id) => id !== post.id));
    }
  };

  const publishComment = async (postId: string) => {
    if (!requireLogin() || !user || busyCommentPostIds.includes(postId)) return;
    const body = (commentDrafts[postId] || '').trim();
    if (!body || body.length > 600) return;

    setBusyCommentPostIds((current) => [...current, postId]);
    try {
      await createCommunityComment(postId, user.id, body);
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
      await refreshPosts();
      setOpenComments(postId);
    } catch (error) {
      console.error('YUKU Community: gagal mengirim komentar', error);
      const code = (error as { code?: string })?.code;
      setNotice(code === 'P0001'
        ? 'Kamu terlalu sering berkomentar. Coba lagi nanti.'
        : 'Komentar belum berhasil dikirim. Coba lagi.');
    } finally {
      setBusyCommentPostIds((current) => current.filter((id) => id !== postId));
    }
  };

  const submitReport = async (postId: string) => {
    if (!requireLogin() || !user || busyReportPostIds.includes(postId)) return;
    const reason = reportReasonsByPost[postId] || 'Konten tidak pantas';
    setBusyReportPostIds((current) => [...current, postId]);
    try {
      await reportCommunityPost(postId, user.id, reason);
      setReportingPostId(null);
      setNotice('Terima kasih. Laporanmu sudah kami terima.');
    } catch (error) {
      console.error('YUKU Community: gagal mengirim laporan', error);
      const code = (error as { code?: string })?.code;
      setNotice(code === '23505'
        ? 'Kamu sudah melaporkan postingan ini. Tunggu Admin meninjaunya.'
        : code === 'P0001'
          ? 'Batas laporan tercapai. Coba lagi nanti.'
          : 'Laporan belum berhasil dikirim. Coba lagi.');
    } finally {
      setBusyReportPostIds((current) => current.filter((id) => id !== postId));
    }
  };

  const submitCommentReport = async (commentId: string) => {
    if (!requireLogin() || !user || busyReportCommentIds.includes(commentId)) return;
    const reason = reportReasonsByComment[commentId] || 'Konten tidak pantas';
    setBusyReportCommentIds((current) => [...current, commentId]);
    try {
      await reportCommunityComment(commentId, user.id, reason);
      setReportingCommentId(null);
      setNotice('Terima kasih. Laporan komentarmu sudah kami terima.');
    } catch (error) {
      console.error('YUKU Community: gagal melaporkan komentar', error);
      const code = (error as { code?: string })?.code;
      setNotice(code === '23505'
        ? 'Kamu sudah melaporkan komentar ini. Tunggu Admin meninjaunya.'
        : code === 'P0001'
          ? 'Batas laporan tercapai. Coba lagi nanti.'
          : 'Laporan komentar belum berhasil dikirim. Coba lagi.');
    } finally {
      setBusyReportCommentIds((current) => current.filter((id) => id !== commentId));
    }
  };

  const visiblePosts = posts.filter((post) => activeTopic === 'Semua' || post.topic === activeTopic);

  return (
    <div className="min-h-screen bg-[#FAF8FC] pb-8">
      <section className="relative isolate overflow-hidden border-b border-purple-100 bg-gradient-to-br from-white via-[#F7F0FF] to-[#FFF3F7] text-slate-900">
        <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-72 w-72 rounded-full bg-fuchsia-300/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-orange-300/25 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 md:flex-row md:items-center md:justify-between md:py-10 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/85 px-3 py-1.5 text-[11px] font-bold tracking-wide text-purple-800 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> RUANG KOMUNITAS YUKU
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-[#1E0938] sm:text-4xl md:text-5xl">
              Temukan teman.
              <span className="block bg-gradient-to-r from-purple-700 via-fuchsia-600 to-amber-500 bg-clip-text text-transparent">
                Mulai cerita baru.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Berbagi minat, ngobrol dengan orang baru, dan temukan aktivitas seru bersama komunitas YUKU.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm">
                <Users className="h-3.5 w-3.5" /> Kenalan dengan komunitas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" /> Ruang yang saling menghargai
              </span>
            </div>
          </div>
          <div className="w-full rounded-2xl border border-purple-100 bg-white/90 p-4 shadow-[0_12px_35px_rgba(76,29,149,0.10)] md:max-w-xs md:p-5">
            <p className="text-xs font-semibold text-purple-700">Dari obrolan sederhana...</p>
            <p className="mt-1 text-lg font-extrabold leading-snug text-[#1E0938]">bisa jadi aktivitas yang berkesan.</p>
            <div className="my-4 h-px bg-purple-100" />
            <p className="text-xs leading-5 text-slate-600">
              Temukan talent dan aktivitas yang cocok, lalu lakukan booking dengan aman melalui YUKU.
            </p>
            <button type="button" onClick={() => onNavigate('/talent')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-orange-500 px-4 py-3 text-xs font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-105">
              Jelajahi talent <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0">
            <section className="relative overflow-hidden rounded-2xl border border-purple-100 bg-white p-4 shadow-[0_8px_28px_rgba(76,29,149,0.06)] sm:rounded-3xl sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-fuchsia-600 text-xs font-black text-white shadow-sm">
                  {user?.email?.slice(0, 1).toUpperCase() || 'YK'}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-slate-900">Apa ceritamu hari ini?</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {isAuthenticated ? 'Bagikan ide, cerita, atau rencana aktivitas.' : 'Masuk untuk mulai berbagi cerita dengan komunitas.'}
                  </p>
                </div>
              </div>
              {isAuthLoading ? (
                <div className="mt-4 rounded-xl bg-[#FAF8FC] p-4 text-xs text-slate-500">Memeriksa akun...</div>
              ) : isAuthenticated ? (
                <>
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
                    placeholder="Tulis sesuatu yang ingin kamu bagikan..." rows={3} maxLength={1200}
                    className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-[#FAF8FC] p-3.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-500" htmlFor="community-topic">Topik</label>
                      <select id="community-topic" value={draftTopic}
                        onChange={(event) => setDraftTopic(event.target.value as CommunityTopic)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100">
                        {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => void publishPost()}
                      disabled={!draft.trim() || isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">
                      <Send className="h-3.5 w-3.5" /> {isSubmitting ? 'Mengirim...' : 'Bagikan'}
                    </button>
                  </div>
                  <p className="mt-2 text-right text-[10px] text-slate-400">{draft.length}/1200 karakter</p>
                </>
              ) : (
                <button type="button" onClick={() => onNavigate('/login')}
                  className="mt-4 flex w-full items-center justify-between rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-left text-xs font-bold text-purple-800 transition hover:bg-purple-100">
                  Login untuk membuat postingan <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {notice && <p className="mt-3 rounded-lg bg-purple-50 px-3 py-2 text-[11px] text-purple-800">{notice}</p>}
            </section>

            <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-700">Temukan obrolan</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Cerita dari komunitas</h2>
                <p className="mt-1 text-xs text-slate-500">Postingan terbaru dari anggota YUKU.</p>
              </div>
              <button type="button" onClick={() => onNavigate('/talent')}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-800 transition hover:text-fuchsia-700">
                Cari teman <Search className="h-3.5 w-3.5" />
              </button>
            </div>

            <div aria-label="Filter topik komunitas" className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
              {['Semua', ...topics].map((topic) => {
                const active = activeTopic === topic;
                return <button key={topic} type="button" onClick={() => setActiveTopic(topic)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-[11px] font-bold transition ${active
                    ? 'border-purple-700 bg-purple-700 text-white shadow-sm'
                    : 'border-purple-100 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-800'}`}>
                  {topic}
                </button>;
              })}
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                <p>{errorMessage}</p>
                <button type="button" onClick={() => void refreshPosts()} className="mt-2 inline-flex items-center gap-1.5 font-bold">
                  <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                </button>
              </div>
            )}

            <div className="mt-3 space-y-4">
              {isLoading ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-500">Memuat cerita komunitas...</div>
              ) : errorMessage ? null : visiblePosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-purple-200 bg-white px-5 py-9 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-sm font-extrabold text-slate-900">
                    {activeTopic === 'Semua' ? 'Belum ada cerita di komunitas' : `Belum ada cerita di topik ${activeTopic}`}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    {activeTopic === 'Semua'
                      ? 'Jadilah yang pertama berbagi cerita, minat, atau rencana aktivitas bersama anggota YUKU.'
                      : 'Coba pilih topik lain atau lihat semua cerita yang dibagikan anggota YUKU.'}
                  </p>
                  {activeTopic === 'Semua' ? (
                    isAuthenticated ? (
                      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="mt-4 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-purple-800">
                        Buat cerita pertama
                      </button>
                    ) : (
                      <button type="button" onClick={() => onNavigate('/login')}
                        className="mt-4 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-purple-800">
                        Login untuk mulai berbagi
                      </button>
                    )
                  ) : (
                    <button type="button" onClick={() => setActiveTopic('Semua')}
                      className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-bold text-purple-800 transition hover:bg-purple-100">
                      Lihat semua cerita
                    </button>
                  )}
                </div>
              ) : visiblePosts.map((post) => (
                <article key={post.id} className="group rounded-2xl border border-purple-100/80 bg-white p-4 shadow-[0_5px_20px_rgba(76,29,149,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-[0_12px_28px_rgba(76,29,149,0.09)] sm:rounded-3xl sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-fuchsia-600 text-xs font-black text-white ring-4 ring-purple-50">
                      {post.author_display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-900">{post.author_display_name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{formatTime(post.created_at)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-purple-50 px-3 py-1.5 text-[10px] font-bold text-purple-800">{post.topic}</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.body}</p>
                  <div className="mt-4 flex items-center gap-4 border-t border-purple-50 pt-3 sm:gap-5">
                    <button type="button" onClick={() => void handleLike(post)} disabled={busyLikeIds.includes(post.id)} aria-pressed={post.likedByMe}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${post.likedByMe ? 'text-fuchsia-700' : 'text-slate-500 hover:text-fuchsia-700'}`}>
                      <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} /> {post.likes_count} Suka
                    </button>
                    <button type="button" onClick={() => setOpenComments((current) => current === post.id ? null : post.id)}
                      aria-expanded={openComments === post.id}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-purple-700">
                      <MessageCircle className="h-4 w-4" /> {post.comments_count} Komentar
                    </button>
                    <button type="button" onClick={() => {
                      if (!requireLogin()) return;
                      setReportingPostId((current) => current === post.id ? null : post.id);
                    }} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600">
                      <Flag className="h-3.5 w-3.5" /> Laporkan
                    </button>
                  </div>
                  {reportingPostId === post.id && (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-rose-50 p-3">
                      <select value={reportReasonsByPost[post.id] || 'Konten tidak pantas'}
                        onChange={(event) => setReportReasonsByPost((current) => ({ ...current, [post.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs">
                        {reportReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                      <button type="button" onClick={() => void submitReport(post.id)} disabled={busyReportPostIds.includes(post.id)}
                        className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Kirim laporan</button>
                    </div>
                  )}
                  {openComments === post.id && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="space-y-2">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="rounded-xl bg-[#FAF8FC] px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 text-xs leading-5 text-slate-600">
                                <span className="font-extrabold text-slate-800">{comment.author_display_name}: </span>{comment.body}
                              </p>
                              <button type="button"
                                onClick={() => {
                                  if (!requireLogin()) return;
                                  setReportingCommentId((current) => current === comment.id ? null : comment.id);
                                }}
                                className="shrink-0 text-[10px] font-semibold text-slate-400 transition hover:text-rose-600"
                                aria-label="Laporkan komentar">
                                Laporkan
                              </button>
                            </div>
                            {reportingCommentId === comment.id && (
                              <div className="mt-2 flex flex-wrap gap-2 rounded-lg bg-rose-50 p-2">
                                <select value={reportReasonsByComment[comment.id] || 'Konten tidak pantas'}
                                  onChange={(event) => setReportReasonsByComment((current) => ({ ...current, [comment.id]: event.target.value }))}
                                  className="min-w-0 flex-1 rounded-lg border border-rose-100 bg-white px-2.5 py-2 text-[11px]">
                                  {reportReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                </select>
                                <button type="button" onClick={() => void submitCommentReport(comment.id)}
                                  disabled={busyReportCommentIds.includes(comment.id)}
                                  className="rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">
                                  {busyReportCommentIds.includes(comment.id) ? 'Mengirim...' : 'Kirim laporan'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {post.comments.length === 0 && <p className="text-xs text-slate-400">Belum ada komentar. Jadilah yang pertama.</p>}
                      </div>
                      {isAuthenticated ? (
                        <div className="mt-3 flex gap-2">
                          <input value={commentDrafts[post.id] || ''}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                            onKeyDown={(event) => { if (event.key === 'Enter') void publishComment(post.id); }}
                            maxLength={600} placeholder="Tulis komentar..."
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
                          <button type="button" onClick={() => void publishComment(post.id)}
                            disabled={!(commentDrafts[post.id] || '').trim() || busyCommentPostIds.includes(post.id)}
                            className="rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-purple-800 disabled:opacity-40">Kirim</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => onNavigate('/login')}
                          className="mt-3 text-xs font-bold text-purple-700">Login untuk berkomentar</button>
                      )}
                    </div>
                  )}
                </article>
              ))}
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
                  <button key={topic} type="button" onClick={() => setActiveTopic(topic)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-purple-50 hover:text-purple-800">
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
              <button type="button" onClick={() => onNavigate('/talent')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110">
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
