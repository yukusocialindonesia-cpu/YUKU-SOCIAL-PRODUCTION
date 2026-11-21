import React, { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { translateAuthError } from '../../lib/authErrors';

const COOLDOWN_SECONDS = 60;

interface ResendConfirmationProps {
  email: string;
  /** Mulai cooldown langsung (dipakai setelah pendaftaran, karena email baru saja terkirim). */
  startCooldown?: boolean;
}

export const ResendConfirmation: React.FC<ResendConfirmationProps> = ({
  email,
  startCooldown = false,
}) => {
  const [cooldown, setCooldown] = useState(startCooldown ? COOLDOWN_SECONDS : 0);
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setInfo('');
    setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (resendError) {
        setError(translateAuthError(resendError));
      } else {
        setInfo(`Email konfirmasi dikirim ulang ke ${email.trim()}. Cek inbox dan folder Spam.`);
        setCooldown(COOLDOWN_SECONDS);
      }
    } catch (err: any) {
      setError(translateAuthError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={handleResend}
        disabled={sending || cooldown > 0 || !email}
        className="w-full py-3 border border-purple-200/80 text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 font-bold text-xs rounded-2xl shadow-[0_12px_26px_-14px_rgba(124,58,237,0.75)] ring-1 ring-white/60 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none"
      >
        <MailCheck className="w-4 h-4" />
        <span>
          {sending
            ? 'Mengirim...'
            : cooldown > 0
            ? `Kirim ulang email konfirmasi (${cooldown}d)`
            : 'Kirim ulang email konfirmasi'}
        </span>
      </button>
      {info && (
        <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-3 text-[11px] text-emerald-800 leading-relaxed shadow-sm backdrop-blur-lg">
          {info}
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-3.5 py-3 text-[11px] text-rose-800 leading-relaxed shadow-sm backdrop-blur-lg">
          {error}
        </p>
      )}
    </div>
  );
};
