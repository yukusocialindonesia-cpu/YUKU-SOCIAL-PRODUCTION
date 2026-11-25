import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Image as ImageIcon, Loader2, Mic, RefreshCw, Video, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ModerationStatus = 'pending' | 'approved' | 'rejected';
type MediaRow = {
  id: string; talent_id: string; media_type: 'photo' | 'video' | 'voice';
  media_url: string; storage_path: string | null; caption: string | null;
  created_at: string; moderation_status: ModerationStatus; moderation_reason: string | null;
  signed_url?: string | null; talent_name?: string;
};
const statusLabel: Record<ModerationStatus, string> = {
  pending: 'Menunggu review', approved: 'Disetujui', rejected: 'Ditolak',
};

export const TalentMediaModerationPanel: React.FC = () => {
  const [items, setItems] = useState<MediaRow[]>([]);
  const loadRequestIdRef = useRef(0);
  const [filter, setFilter] = useState<ModerationStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshPreviewUrl = async (item: MediaRow): Promise<boolean> => {
    if (!item.storage_path) return false;
    const { data, error } = await supabase.storage.from('talent-media').createSignedUrl(item.storage_path, 1800);
    if (error || !data?.signedUrl) return false;
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, signed_url: data.signedUrl } : row));
    return true;
  };

  const handlePreviewUrlError = (item: MediaRow, element: HTMLImageElement | HTMLMediaElement) => {
    if (element.dataset.urlRefreshAttempted === 'true') return;
    element.dataset.urlRefreshAttempted = 'true';
    void refreshPreviewUrl(item);
  };

  const loadItems = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true); setError(null);
    try {
      const { data, error: queryError } = await supabase.from('talent_media')
        .select('id,talent_id,media_type,media_url,storage_path,caption,created_at,moderation_status,moderation_reason')
        .order('created_at', { ascending: false }).limit(100);
      if (queryError) throw queryError;
      if (requestId !== loadRequestIdRef.current) return;
      const rows = (data || []) as MediaRow[];
      const talentIds = Array.from(new Set(rows.map((row) => row.talent_id)));
      const { data: profiles, error: profileError } = talentIds.length
        ? await supabase.from('talent_profiles').select('id,display_name,city').in('id', talentIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      if (requestId !== loadRequestIdRef.current) return;
      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
      const enriched = await Promise.all(rows.map(async (row) => {
        let signedUrl: string | null = null;
        if (row.storage_path) {
          const { data: signed, error: signedError } = await supabase.storage.from('talent-media').createSignedUrl(row.storage_path, 1800);
          if (!signedError) signedUrl = signed?.signedUrl || null;
        }
        return { ...row, signed_url: signedUrl, talent_name: profileMap.get(row.talent_id)?.display_name || 'Talent' };
      }));
      if (requestId === loadRequestIdRef.current) setItems(enriched);
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Gagal memuat antrean moderasi media.');
    } finally { if (requestId === loadRequestIdRef.current) setLoading(false); }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);
  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.moderation_status === filter), [items, filter]);
  const counts = useMemo(() => ({
    pending: items.filter((item) => item.moderation_status === 'pending').length,
    approved: items.filter((item) => item.moderation_status === 'approved').length,
    rejected: items.filter((item) => item.moderation_status === 'rejected').length,
  }), [items]);

  const review = async (item: MediaRow, decision: 'approved' | 'rejected') => {
    const reason = decision === 'rejected' ? window.prompt('Tuliskan alasan penolakan media:') : null;
    if (decision === 'rejected' && !reason?.trim()) return;
    setWorkingId(item.id); setError(null); setNotice(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_review_talent_media', {
        p_media_id: item.id, p_decision: decision, p_reason: reason?.trim() || null,
      });
      if (rpcError) throw rpcError;
      setNotice('Media ' + (decision === 'approved' ? 'disetujui' : 'ditolak') + ' untuk ' + item.talent_name + '.');
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan keputusan moderasi.');
    } finally { setWorkingId(null); }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-purple-100 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-base font-black text-slate-900">Moderasi Galeri Talent</h3>
            <p className="mt-1 text-xs text-slate-500">Foto, video, dan audio baru hanya tampil di profil publik setelah disetujui Admin Talent.</p></div>
          <button type="button" onClick={() => void loadItems()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Muat ulang
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={'rounded-xl border px-3 py-2 text-xs font-bold ' + (filter === value ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-200 text-slate-600')}>
              {(value === 'all' ? 'Semua' : statusLabel[value]) + ' (' + (value === 'all' ? items.length : counts[value]) + ')'}
            </button>
          ))}
        </div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Memuat media...</div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Tidak ada media pada kategori ini.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-950">
                {item.signed_url && item.media_type === 'photo' && <img src={item.signed_url} alt={item.caption || 'Foto Talent'} onError={(e) => handlePreviewUrlError(item, e.currentTarget)} className="h-full w-full object-contain" />}
                {item.signed_url && item.media_type === 'video' && <video src={item.signed_url} controls preload="metadata" onError={(e) => handlePreviewUrlError(item, e.currentTarget)} className="h-full w-full" />}
                {item.signed_url && item.media_type === 'voice' && <div className="w-full p-4"><Mic className="mx-auto mb-3 h-8 w-8 text-white" /><audio src={item.signed_url} controls onError={(e) => handlePreviewUrlError(item, e.currentTarget)} className="w-full" /></div>}
                {!item.signed_url && <div className="px-4 text-center text-xs text-slate-300">Pratinjau tidak tersedia. Periksa akses Storage.</div>}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-800">
                    {item.media_type === 'photo' ? <ImageIcon className="h-4 w-4 shrink-0" /> : item.media_type === 'video' ? <Video className="h-4 w-4 shrink-0" /> : <Mic className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.talent_name}</span>
                  </div>
                  <span className={'shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ' + (item.moderation_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : item.moderation_status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800')}>{statusLabel[item.moderation_status]}</span>
                </div>
                {item.caption && <p className="text-xs text-slate-600">{item.caption}</p>}
                {item.moderation_reason && <p className="text-[11px] text-rose-700">Alasan: {item.moderation_reason}</p>}
                <p className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString('id-ID')}</p>
                {item.moderation_status === 'approved' ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Disetujui; tampil jika profil Talent juga aktif dan disetujui</div>
                    <button type="button" disabled={workingId === item.id} onClick={() => void review(item, 'rejected')} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Cabut persetujuan</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" disabled={workingId === item.id} onClick={() => void review(item, 'approved')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Setujui</button>
                    <button type="button" disabled={workingId === item.id} onClick={() => void review(item, 'rejected')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Tolak</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
