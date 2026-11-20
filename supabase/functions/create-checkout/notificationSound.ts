/**
 * Bunyi notifikasi YUKU (Web Audio API, tanpa file audio).
 *
 * - Browser memblokir audio sebelum ada interaksi pengguna, jadi AudioContext
 *   dibuat/di-resume pada klik/ketuk/tombol pertama (lihat installSoundUnlock).
 * - Preferensi bisu disimpan di localStorage (aman jika storage diblokir).
 * - Ada throttle singkat agar beberapa notifikasi beruntun tidak saling tumpang.
 */

export type SoundKind = 'booking' | 'money' | 'alert' | 'chat';

const MUTE_KEY = 'yuku:sound-muted';
const MIN_GAP_MS = 700;
const VOLUME = 0.18;

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;
let unlockInstalled = false;
let muted = readMuted();
const muteListeners = new Set<(value: boolean) => void>();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** Pasang sekali: membuka kunci audio pada interaksi pertama pengguna. */
export function installSoundUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;

  const unlock = () => {
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    if (ctx && ctx.state !== 'closed') {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    }
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });
}

interface Note {
  freq: number;
  start: number; // detik relatif
  dur: number;
  type?: OscillatorType;
}

const PATTERNS: Record<SoundKind, { notes: Note[]; vibrate: number[] }> = {
  // Pesanan/booking: tiga nada naik (ceria)
  booking: {
    notes: [
      { freq: 659.25, start: 0, dur: 0.14 },
      { freq: 783.99, start: 0.12, dur: 0.14 },
      { freq: 1046.5, start: 0.24, dur: 0.28 },
    ],
    vibrate: [90, 50, 90],
  },
  // Uang masuk/pencairan/refund: dua nada "ding-ding" tinggi
  money: {
    notes: [
      { freq: 987.77, start: 0, dur: 0.12, type: 'triangle' },
      { freq: 1318.51, start: 0.11, dur: 0.12, type: 'triangle' },
      { freq: 1760, start: 0.22, dur: 0.34, type: 'triangle' },
    ],
    vibrate: [60, 40, 60, 40, 120],
  },
  // Peringatan sistem/keamanan: dua beep lebih rendah
  alert: {
    notes: [
      { freq: 440, start: 0, dur: 0.16, type: 'square' },
      { freq: 440, start: 0.24, dur: 0.16, type: 'square' },
    ],
    vibrate: [180, 80, 180],
  },
  // Pesan chat: "pop" pendek
  chat: {
    notes: [
      { freq: 880, start: 0, dur: 0.07 },
      { freq: 1174.66, start: 0.07, dur: 0.1 },
    ],
    vibrate: [40],
  },
};

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // storage diblokir: preferensi hanya berlaku selama sesi
  }
  muteListeners.forEach((listener) => listener(value));
}

export function subscribeSoundMuted(listener: (value: boolean) => void): () => void {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

/** Putar bunyi. Mengembalikan true jika benar-benar diputar. */
export function playNotificationSound(kind: SoundKind): boolean {
  if (muted) return false;

  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return false;

  const ctx = getContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    // Belum ada interaksi pengguna: coba resume, jika tetap gagal lewati saja.
    ctx.resume().catch(() => undefined);
    if (ctx.state === 'suspended') return false;
  }

  lastPlayedAt = now;
  const pattern = PATTERNS[kind];
  const t0 = ctx.currentTime;

  pattern.notes.forEach((note) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, t0 + note.start);

    gain.gain.setValueAtTime(0.0001, t0 + note.start);
    gain.gain.exponentialRampToValueAtTime(VOLUME, t0 + note.start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.start + note.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + note.start);
    osc.stop(t0 + note.start + note.dur + 0.02);
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern.vibrate);
    }
  } catch {
    // vibrate tidak didukung
  }

  return true;
}

/** Petakan tipe notifikasi database ke jenis bunyi. */
export function soundKindForNotification(type: string | null | undefined): SoundKind {
  switch (type) {
    case 'payment_status':
    case 'payout_status':
    case 'referral_bonus':
      return 'money';
    case 'booking_update':
      return 'booking';
    case 'system_alert':
    default:
      return 'alert';
  }
}
