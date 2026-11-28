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
    <div className="min-h-screen bg-[#F8F7FA] pb-5">
      <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-5 sm:py-5">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0">
            <section className="rounded-2xl border border-[#E7E1EA] bg-white px-3 py-3 shadow-[0_4px_18px_rgba(50,19,79,0.045)] sm:px-5 sm:py-4 sm:shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#32134F] text-xs font-black text-white">
                  {user?.email?.slice(0, 1).toUpperCase() || 'YK'}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#241631]">Bagikan sesuatu ke YUKU</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {isAuthenticated ? 'Cerita, ide, atau rencana aktivitasmu.' : 'Masuk untuk mulai berbagi cerita dengan komunitas.'}
                  </p>
                </div>
              </div>
              {isAuthLoading ? (
                <div className="mt-4 rounded-xl bg-[#F8F7FA] p-4 text-xs text-slate-500">Memeriksa akun...</div>
              ) : isAuthenticated ? (
                <>
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
                    placeholder="Apa yang sedang kamu pikirkan?" rows={2} maxLength={1200}
                    className="mt-3 w-full resize-none rounded-xl border border-[#E7E1EA] bg-[#F8F7FA] p-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#32134F] focus:ring-2 focus:ring-[#32134F]/10" />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-500" htmlFor="community-topic">Topik</label>
                      <select id="community-topic" value={draftTopic}
                        onChange={(event) => setDraftTopic(event.target.value as CommunityTopic)}
                        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#E5DCEB] focus:ring-2 focus:ring-[#32134F]/10">
                        {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => void publishPost()}
                      disabled={!draft.trim() || isSubmitting}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#32134F] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#482064] disabled:cursor-not-allowed disabled:opacity-40">
                      <Send className="h-3.5 w-3.5" /> {isSubmitting ? 'Mengirim...' : 'Bagikan'}
                    </button>
                  </div>
                  <p className="mt-2 text-right text-[10px] text-slate-400">{draft.length}/1200 karakter</p>
                </>
              ) : (
                <button type="button" onClick={() => onNavigate('/login')}
                  className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#E5DCEB] bg-[#F4F0F7] px-4 py-3 text-left text-xs font-bold text-[#32134F] transition hover:bg-[#F4F0F7]">
                  Login untuk membuat postingan <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {notice && <p className="mt-3 rounded-lg bg-[#F4F0F7] px-3 py-2 text-[11px] text-[#32134F]">{notice}</p>}
            </section>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-3 px-1 sm:px-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6F6478]">YUKU SOCIAL</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-[#241631] sm:text-2xl">Beranda</h2>
                <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">Temukan cerita, teman, dan aktivitas.</p>
              </div>
              <button type="button" onClick={() => onNavigate('/talent')}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#32134F] transition hover:text-[#32134F]">
                Cari teman <Search className="h-3.5 w-3.5" />
              </button>
            </div>

            <div aria-label="Filter topik komunitas" className="mt-3 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] sm:px-0">
              {['Semua', ...topics].map((topic) => {
                const active = activeTopic === topic;
                return <button key={topic} type="button" onClick={() => setActiveTopic(topic)}
                  className={`min-h-9 shrink-0 rounded-full border px-3.5 py-2 text-[11px] font-bold shadow-sm transition ${active
                    ? 'border-[#32134F] bg-[#32134F] text-white shadow-sm'
                    : 'border-[#E5DCEB] bg-white text-slate-600 hover:border-[#E5DCEB] hover:text-[#32134F]'}`}>
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

            <div className="mt-2 space-y-3 sm:space-y-4">
              {isLoading ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-500">Memuat cerita komunitas...</div>
              ) : errorMessage ? null : visiblePosts.length === 0 ? (
                <div className="rounded-[1.7rem] border border-dashed border-[#E5DCEB]/90 bg-white/85 px-5 py-9 text-center shadow-[0_4px_18px_rgba(50,19,79,0.05)] ring-1 ring-white backdrop-blur-lg">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F0F7] text-[#32134F]">
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
                        className="mt-4 rounded-xl bg-[#32134F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#32134F]">
                        Buat cerita pertama
                      </button>
                    ) : (
                      <button type="button" onClick={() => onNavigate('/login')}
                        className="mt-4 rounded-xl bg-[#32134F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#32134F]">
                        Login untuk mulai berbagi
                      </button>
                    )
                  ) : (
                    <button type="button" onClick={() => setActiveTopic('Semua')}
                      className="mt-4 rounded-xl border border-[#E5DCEB] bg-[#F4F0F7] px-4 py-2.5 text-xs font-bold text-[#32134F] transition hover:bg-[#F4F0F7]">
                      Lihat semua cerita
                    </button>
                  )}
                </div>
              ) : visiblePosts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-[#E7E1EA] bg-white px-3.5 py-4 shadow-[0_4px_18px_rgba(50,19,79,0.035)] sm:p-5 sm:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#32134F] text-xs font-bold text-white">
                      {post.author_display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-900">{post.author_display_name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{formatTime(post.created_at)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#F4F0F7] px-3 py-1.5 text-[10px] font-semibold text-[#32134F]">{post.topic}</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.body}</p>
                  <div className="mt-4 flex items-center gap-4 border-t border-[#E7E1EA] pt-3 sm:gap-5">
                    <button type="button" onClick={() => void handleLike(post)} disabled={busyLikeIds.includes(post.id)} aria-pressed={post.likedByMe}
                      className={`inline-flex min-h-11 items-center gap-2 pr-2 text-xs font-bold transition ${post.likedByMe ? 'text-[#32134F]' : 'text-slate-500 hover:text-[#32134F]'}`}>
                      <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} /> {post.likes_count} Suka
                    </button>
                    <button type="button" onClick={() => setOpenComments((current) => current === post.id ? null : post.id)}
                      aria-expanded={openComments === post.id}
                      className="inline-flex min-h-11 items-center gap-2 pr-2 text-xs font-bold text-slate-500 transition hover:text-[#32134F]">
                      <MessageCircle className="h-4 w-4" /> {post.comments_count} Komentar
                    </button>
                    <button type="button" onClick={() => {
                      if (!requireLogin()) return;
                      setReportingPostId((current) => current === post.id ? null : post.id);
                    }} className="ml-auto inline-flex min-h-11 items-center gap-2 pl-2 text-xs font-semibold text-slate-400 hover:text-rose-600">
                      <Flag className="h-3.5 w-3.5" /> Laporkan
                    </button>
                  </div>
                  {reportingPostId === post.id && (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-rose-50 p-3">
                      <select value={reportReasonsByPost[post.id] || 'Konten tidak pantas'}
                        onChange={(event) => setReportReasonsByPost((current) => ({ ...current, [post.id]: event.target.value }))}
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs">
                        {reportReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                      <button type="button" onClick={() => void submitReport(post.id)} disabled={busyReportPostIds.includes(post.id)}
                        className="min-h-11 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Kirim laporan</button>
                    </div>
                  )}
                  {openComments === post.id && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="space-y-2">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="rounded-2xl border border-[#E5DCEB]/70 bg-white/75 px-3 py-2.5 shadow-sm">
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
                                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-rose-100 bg-white px-2.5 py-2 text-[11px]">
                                  {reportReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                </select>
                                <button type="button" onClick={() => void submitCommentReport(comment.id)}
                                  disabled={busyReportCommentIds.includes(comment.id)}
                                  className="min-h-11 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">
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
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#E5DCEB] focus:ring-2 focus:ring-[#32134F]/10" />
                          <button type="button" onClick={() => void publishComment(post.id)}
                            disabled={!(commentDrafts[post.id] || '').trim() || busyCommentPostIds.includes(post.id)}
                            className="rounded-xl bg-[#32134F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#32134F] disabled:opacity-40">Kirim</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => onNavigate('/login')}
                          className="mt-3 text-xs font-bold text-[#32134F]">Login untuk berkomentar</button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </main>

          <aside className="hidden space-y-4 lg:block">
            <section className="rounded-[1.6rem] border border-white bg-white/85 p-5 shadow-[0_12px_34px_rgba(76,29,149,0.075)] ring-1 ring-purple-100/80 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Jelajahi topik</h3>
                <Hash className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Pilih ruang obrolan sesuai minatmu.</p>
              <div className="mt-3 space-y-1">
                {topics.map((topic) => (
                  <button key={topic} type="button" onClick={() => setActiveTopic(topic)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-[#F4F0F7] hover:text-[#32134F]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F4F0F7] text-purple-600"><Hash className="h-3.5 w-3.5" /></span>
                    {topic}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
                  </button>
                ))}
              </div>
            </section>
            <section className="overflow-hidden rounded-[1.6rem] border border-white bg-gradient-to-br from-purple-50/95 via-white to-fuchsia-50/95 p-5 shadow-[0_14px_36px_rgba(76,29,149,0.08)] ring-1 ring-purple-100/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#32134F] shadow-sm"><Users className="h-5 w-5" /></div>
              <h3 className="mt-3 text-sm font-extrabold text-slate-900">Dari kenalan ke aktivitas</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Temukan talent, pilih aktivitas yang kamu suka, lalu lakukan booking melalui sistem YUKU.</p>
              <button type="button" onClick={() => onNavigate('/talent')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110">
                Lihat talent <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </section>
            <section className="rounded-[1.6rem] border border-white bg-gradient-to-br from-amber-50 to-white p-5 shadow-[0_14px_36px_rgba(180,83,9,0.07)] ring-1 ring-amber-100/90">
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
