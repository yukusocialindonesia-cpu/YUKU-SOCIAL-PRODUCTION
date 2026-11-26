import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  ShieldCheck,
  Check,
  CheckCheck,
  MessageSquare,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BookingMessageRow } from '../../types/database';

export interface ChatBookingSummary {
  id: string;
  booking_code: string;
  status: string;
  start_time: string;
  duration_hours: number;
  meeting_location_name: string;
  activity_title?: string;
}

interface BookingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ChatBookingSummary | null;
  currentUserId: string;
  partnerName: string;
  partnerRoleLabel: string;
  partnerAvatar?: string | null;
}

interface UiChatMessage extends BookingMessageRow {
  pending?: boolean;
}

const STARTER_PROMPTS = [
  'Halo! Konfirmasi jadwal & titik temu kita ya.',
  'Di area mana persisnya kita ketemu nanti?',
  'Apakah ada preferensi topik atau aktivitas?',
];

export const BookingChatModal: React.FC<BookingChatModalProps> = ({
  isOpen,
  onClose,
  booking,
  currentUserId,
  partnerName,
  partnerRoleLabel,
  partnerAvatar,
}) => {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingClearTimerRef = useRef<number | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  const scrollToBottom = useCallback((instant = false) => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? 'auto' : 'smooth',
      });
    }, 30);
  }, []);

  const markIncomingAsRead = useCallback(
    async (bookingId: string) => {
      try {
        await supabase
          .from('booking_messages')
          .update({ is_read: true })
          .eq('booking_id', bookingId)
          .neq('sender_id', currentUserId)
          .eq('is_read', false);
      } catch {
        // Non-critical read-receipt update
      }
    },
    [currentUserId]
  );

  const loadMessages = useCallback(
    async (bookingId: string) => {
      setIsLoadingMessages(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from('booking_messages')
          .select('id, booking_id, sender_id, message, is_read, created_at')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('booking_messages') || msg.includes('does not exist') || msg.includes('schema cache')) {
            setMigrationMissing(true);
            setMessages([]);
            return;
          }
          throw error;
        }

        setMigrationMissing(false);
        const rows = (data as BookingMessageRow[]) || [];
        setMessages(rows);
        scrollToBottom(true);

        if (rows.some((r) => r.sender_id !== currentUserId && !r.is_read)) {
          markIncomingAsRead(bookingId);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Gagal memuat riwayat percakapan.');
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [currentUserId, markIncomingAsRead, scrollToBottom]
  );

  useEffect(() => {
    if (!isOpen || !booking) return;

    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, booking, onClose]);

  useEffect(() => {
    if (!isOpen || !booking?.id || !currentUserId) return;

    setMessages([]);
    setDraft('');
    setIsPartnerOnline(false);
    setIsPartnerTyping(false);
    setConnectionState('connecting');

    loadMessages(booking.id);

    const channel = supabase.channel(`booking-chat:${booking.id}`, {
      config: {
        presence: { key: currentUserId },
      },
    });

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_messages',
          filter: `booking_id=eq.${booking.id}`,
        },
        (payload) => {
          const incoming = payload.new as BookingMessageRow;
          if (!incoming?.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) {
              return prev;
            }
            return [...prev, incoming];
          });

          if (incoming.sender_id !== currentUserId) {
            setIsPartnerTyping(false);
            markIncomingAsRead(booking.id);
          }

          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'booking_messages',
          filter: `booking_id=eq.${booking.id}`,
        },
        (payload) => {
          const updated = payload.new as BookingMessageRow;
          if (!updated?.id) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, is_read: updated.is_read } : m))
          );
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherUsersOnline = Object.keys(state).some((key) => key !== currentUserId);
        setIsPartnerOnline(otherUsersOnline);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.user_id === currentUserId) return;
        setIsPartnerTyping(Boolean(payload.is_typing));
        if (typingClearTimerRef.current !== null) {
          window.clearTimeout(typingClearTimerRef.current);
        }
        if (payload.is_typing) {
          typingClearTimerRef.current = window.setTimeout(() => {
            setIsPartnerTyping(false);
          }, 2600);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
          try {
            await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
          } catch {
            // Presence tracking optional
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionState('reconnecting');
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingClearTimerRef.current !== null) {
        window.clearTimeout(typingClearTimerRef.current);
        typingClearTimerRef.current = null;
      }
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [isOpen, booking?.id, currentUserId, loadMessages, markIncomingAsRead, scrollToBottom]);

  const emitTypingStatus = useCallback(
    (isTyping: boolean) => {
      const channel = channelRef.current;
      if (!channel) return;
      const now = Date.now();
      if (isTyping && now - lastTypingEmitRef.current < 1200) return;
      lastTypingEmitRef.current = now;

      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUserId, is_typing: isTyping },
      });
    },
    [currentUserId]
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !currentUserId || isSending || !['paid_held_in_escrow', 'confirmed_by_talent', 'in_progress'].includes(booking.status)) return;

    const cleanText = draft.trim();
    if (!cleanText) return;
    if (cleanText.length > 1000) {
      setErrorMsg('Pesan maksimal 1.000 karakter.');
      return;
    }

    setErrorMsg(null);
    setIsSending(true);
    emitTypingStatus(false);

    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: UiChatMessage = {
      id: tempId,
      booking_id: booking.id,
      sender_id: currentUserId,
      message: cleanText,
      is_read: false,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft('');
    scrollToBottom();

    try {
      const { data: insertedRow, error } = await supabase
        .from('booking_messages')
        .insert({
          booking_id: booking.id,
          sender_id: currentUserId,
          message: cleanText,
        })
        .select('id, booking_id, sender_id, message, is_read, created_at')
        .single();

      if (error) throw error;

      const confirmed = insertedRow as BookingMessageRow;
      setMessages((prev) => {
        const alreadyInsertedViaRealtime = prev.some((m) => m.id === confirmed.id);
        if (alreadyInsertedViaRealtime) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? confirmed : m));
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(cleanText);
      const msg = err?.message || 'Gagal mengirim pesan.';
      if (msg.toLowerCase().includes('booking_messages') || msg.toLowerCase().includes('does not exist')) {
        setMigrationMissing(true);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !booking || !['paid_held_in_escrow', 'confirmed_by_talent', 'in_progress', 'completed', 'disputed_hold'].includes(booking.status)) return null;
  const isReadOnlyChat = ['completed', 'disputed_hold'].includes(booking.status);

  const scheduleText = new Date(booking.start_time).toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chat booking ${booking.booking_code}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col overflow-hidden border border-white/80 bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAFF_100%)] shadow-[0_28px_90px_rgba(30,9,56,0.28)] sm:h-[680px] sm:max-h-[90dvh] sm:max-w-xl sm:rounded-[1.8rem] sm:ring-1 sm:ring-white/50"
      >
        {/* Top Chat Header */}
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#210B3C] via-purple-900 to-[#42105F] px-4 py-4 text-white shadow-[0_10px_28px_rgba(30,9,56,0.22)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/15 shadow-[0_0_0_4px_rgba(255,255,255,0.08)]">
              {partnerAvatar ? (
                <img
                  src={partnerAvatar}
                  alt={partnerName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-5 h-5 text-purple-200" />
              )}
              {isPartnerOnline && (
                <span
                  title="Sedang aktif di chat"
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-purple-950"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">{partnerName}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/15 text-purple-100 shrink-0">
                  {partnerRoleLabel}
                </span>
              </div>
              <div className="text-[11px] text-purple-200/90 flex items-center gap-1.5">
                {isPartnerTyping ? (
                  <span className="text-amber-300 font-semibold">Sedang mengetik...</span>
                ) : isPartnerOnline ? (
                  <span className="text-emerald-300 font-medium">Online di ruang chat</span>
                ) : connectionState === 'connected' ? (
                  <span>Chat Real-Time Aktif</span>
                ) : (
                  <span>Menghubungkan...</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela chat"
            className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Booking Context Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-purple-100/70 bg-white/80 px-4 py-3 text-[11px] text-slate-700 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span className="font-mono font-extrabold text-purple-900 bg-white border border-purple-200 px-2 py-0.5 rounded">
              {booking.booking_code}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <span>{scheduleText} ({booking.duration_hours}j)</span>
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600 truncate max-w-[240px]">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="min-w-0 whitespace-normal break-words leading-relaxed">{booking.meeting_location_name}</span>
            </span>
          </div>
        </div>

        {/* Safety Strip */}
        <div className="flex shrink-0 items-start gap-1.5 border-b border-amber-100/80 bg-amber-50/80 px-4 py-2.5 text-[11px] text-amber-900">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="truncate">
            Bahas detail sesi &amp; titik temu di ruang publik. Hindari transaksi di luar platform YUKU.
          </span>
        </div>

        {/* Message List */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(216,180,254,0.18),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F7F3FB_100%)] p-4">
          {migrationMissing ? (
            <div className="space-y-1.5 rounded-2xl border border-amber-200/90 bg-amber-50/95 p-4 text-xs text-amber-900 shadow-sm">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Tabel Chat Belum Diaktifkan di Supabase</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Jalankan file migrasi{' '}
                <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">
                  supabase/migrations/17_booking_chat_messages.sql
                </code>{' '}
                di Supabase SQL Editor untuk mengaktifkan chat real-time per booking.
              </p>
            </div>
          ) : isLoadingMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 gap-2 py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-700" />
              <span>Memuat percakapan...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-white text-purple-700 shadow-[0_12px_28px_rgba(76,29,149,0.12)] ring-1 ring-purple-100">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-bold text-slate-800">
                  Mulai Diskusi Detail Booking
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Kirim pesan pertama ke {partnerName} untuk menyepakati titik temu, aktivitas, atau pertanyaan seputar jadwal.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setDraft(prompt)}
                    className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              const timeStr = new Date(msg.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs space-y-1 ${
                      isMine
                        ? 'bg-gradient-to-br from-purple-700 via-purple-700 to-fuchsia-700 text-white rounded-br-sm shadow-[0_8px_22px_rgba(109,40,217,0.18)]'
                        : 'bg-white/95 text-slate-800 border border-purple-100/90 rounded-bl-sm shadow-[0_8px_22px_rgba(76,29,149,0.06)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.message}
                    </p>
                    <div
                      className={`flex items-center justify-end gap-1 text-[10px] tabular-nums ${
                        isMine ? 'text-purple-200' : 'text-slate-400'
                      }`}
                    >
                      <span>{msg.pending ? 'Mengirim...' : timeStr}</span>
                      {isMine && !msg.pending && (
                        msg.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-purple-200" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Inline Error */}
        {errorMsg && (
          <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-[11px] text-rose-800 flex flex-wrap items-start justify-between gap-2 shrink-0">
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-relaxed">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="font-bold text-rose-700 hover:underline shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {isReadOnlyChat && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
            Booking ini sudah selesai atau dalam peninjauan. Chat hanya dapat dibaca.
          </div>
        )}

        {/* Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="flex shrink-0 items-end gap-2 border-t border-purple-100/80 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(76,29,149,0.06)] backdrop-blur-xl"
        >
          <textarea
            rows={1}
            maxLength={1000}
            value={draft}
            disabled={migrationMissing || isReadOnlyChat}
            onChange={(e) => {
              setDraft(e.target.value);
              emitTypingStatus(Boolean(e.target.value.trim()));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={`Tulis pesan ke ${partnerName}...`}
            className="max-h-28 flex-1 resize-none rounded-2xl border border-purple-100 bg-[#FAF8FC] px-3.5 py-3 text-xs shadow-inner shadow-purple-950/[0.025] focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 sm:text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim() || migrationMissing || isReadOnlyChat}
            aria-label="Kirim pesan"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-700 via-fuchsia-700 to-orange-500 px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(109,40,217,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Kirim</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
