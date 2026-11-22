import React, { useState } from 'react';
import { Star, MapPin, ArrowRight, Mic, Video, Image as ImageIcon, Heart } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { TalentProfile } from '../../types/talent';
import { formatRupiah } from '../../utils/formatters';

interface TalentCardProps {
  talent: TalentProfile;
  onSelect: (talentId: string) => void;
  availableToday?: boolean;
  mediaTypes?: string[];
  priceMode?: 'online' | 'offline' | 'all';
  showPrice?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (talentId: string) => void;
}

// Foto stok bawaan lama dianggap "belum ada foto", supaya kartu tidak terlihat kembar.
const PLACEHOLDER_PHOTO_MARKER = 'photo-1534528741775-53994a69daeb';

const GRADIENTS = [
  'from-purple-600 via-fuchsia-600 to-pink-500',
  'from-indigo-600 via-purple-600 to-fuchsia-500',
  'from-fuchsia-600 via-pink-600 to-orange-400',
  'from-violet-700 via-purple-600 to-sky-500',
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Y';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return letters.toUpperCase();
}

export const TalentCard: React.FC<TalentCardProps> = ({ talent, onSelect, availableToday, mediaTypes = [], priceMode = 'all', showPrice = true, isFavorite = false, onToggleFavorite }) => {
  const [imageFailed, setImageFailed] = useState(false);

  const hasVoice = mediaTypes.includes('voice');
  const hasVideo = mediaTypes.includes('video');
  const hasPhoto = mediaTypes.includes('photo');
  const isOnlineOnly = talent.serviceMode === 'Online Only';
  const showOnlineRate = priceMode === 'online' || (priceMode === 'all' && isOnlineOnly);
  const displayedRate = showOnlineRate ? talent.onlineChatRate : talent.hourlyRate;
  const serviceModeLabel = talent.serviceMode === 'Online Only'
    ? 'Online'
    : talent.serviceMode === 'Offline Only'
      ? 'Offline'
      : talent.serviceMode === 'Offline & Online'
        ? 'Online & Offline'
        : '';

  const hasRealPhoto =
    Boolean(talent.avatarUrl) &&
    !talent.avatarUrl!.includes(PLACEHOLDER_PHOTO_MARKER) &&
    !imageFailed;

  // Label BARU hanya untuk talent yang mendaftar dalam 7 hari terakhir.
  const registeredAt = talent.createdAt ? Date.parse(talent.createdAt) : Number.NaN;
  const ageSinceRegistration = Date.now() - registeredAt;
  const isNew =
    Number.isFinite(registeredAt) &&
    ageSinceRegistration >= 0 &&
    ageSinceRegistration < 7 * 24 * 60 * 60 * 1000;

  return (
    <article
      onClick={() => onSelect(talent.id)}
      className="group relative h-full bg-white/95 rounded-2xl sm:rounded-[28px] overflow-hidden border border-white shadow-[0_12px_34px_rgba(76,29,149,0.10),0_3px_10px_rgba(76,29,149,0.05)] hover:shadow-[0_20px_44px_rgba(76,29,149,0.18)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col ring-1 ring-purple-100/70"
    >
      {/* Media */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {hasRealPhoto ? (
          <img
            src={talent.avatarUrl}
            alt={`Foto profil ${talent.name}`}
            className="w-full h-full object-cover object-[50%_20%] group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${pickGradient(talent.id)} flex items-center justify-center`}
          >
            <span className="text-6xl font-black text-white/90 tracking-tight drop-shadow-sm">
              {initialsOf(talent.name)}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />

        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorite ? `Hapus ${talent.name} dari favorit` : `Tambahkan ${talent.name} ke favorit`}
            aria-pressed={isFavorite}
            onClick={(event) => { event.stopPropagation(); onToggleFavorite(talent.id); }}
            className="absolute left-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-purple-700 shadow-sm backdrop-blur-sm transition hover:scale-105 sm:left-3 sm:top-3 sm:h-9 sm:w-9"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        )}

        {/* Badge BARU tetap di atas; status ketersediaan dipindah ke bawah foto. */}
        {isNew && (
          <div className="absolute top-3 right-3">
            <span className="shrink-0 inline-flex items-center h-[22px] px-2.5 rounded-full bg-amber-400 text-amber-950 text-[9.5px] font-extrabold tracking-widest">
              BARU
            </span>
          </div>
        )}

        {/* Identitas talent, usia, lokasi, dan rating di atas foto */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 flex items-end justify-between gap-1.5 sm:gap-2 text-white">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] sm:text-base font-extrabold leading-tight drop-shadow line-clamp-1">
                {talent.name}{talent.age ? `, ${talent.age}` : ''}
              </span>
              {talent.isVerified === true && <VerifiedBadge className="shrink-0" />}
            </div>
            <div className="mt-1 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium">
              {talent.city && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                  <span className="truncate">{talent.city}</span>
                </span>
              )}
              {(talent.reviewCount ?? 0) > 0 && talent.rating !== undefined && (
                <span className="inline-flex items-center gap-1 shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {talent.rating.toFixed(1)} <span className="text-white/80">({talent.reviewCount})</span>
                </span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Status ketersediaan dan ikon media: di bawah foto, tidak menimpa gambar */}
      {(availableToday || serviceModeLabel || hasVoice || hasVideo || hasPhoto) && (
        <div className="px-2 pt-1 sm:px-4 sm:pt-3 flex flex-wrap gap-1 sm:gap-1.5">
          {serviceModeLabel && (
            <span className="inline-flex items-center h-5 sm:h-6 rounded-full bg-emerald-50 border border-emerald-100 px-2 sm:px-2.5 text-[9px] sm:text-[10.5px] font-semibold text-emerald-800">
              {serviceModeLabel}
            </span>
          )}
          {availableToday && (
            <span className="inline-flex items-center gap-1 h-5 sm:h-6 pl-1.5 pr-2 sm:pl-2 sm:pr-2.5 rounded-full bg-purple-50 border border-purple-100 text-purple-800 text-[9px] sm:text-[10.5px] font-semibold">
              <span className="relative flex shrink-0 w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-fuchsia-500 opacity-40 animate-ping motion-reduce:animate-none" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-fuchsia-600" />
              </span>
              Tersedia hari ini
            </span>
          )}
          {hasVoice && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-800 bg-fuchsia-50 border border-fuchsia-100 px-2 py-0.5 rounded-full">
              <Mic className="w-3 h-3" /> Voice
            </span>
          )}
          {hasVideo && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              <Video className="w-3 h-3" /> Video
            </span>
          )}
          {hasPhoto && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
              <ImageIcon className="w-3 h-3" /> Foto
            </span>
          )}
        </div>
      )}

      {/* Isi */}
      <div className="p-2 pt-1.5 sm:p-4 sm:pt-3 xl:p-5 xl:pt-3 flex flex-col flex-1">
        {showPrice && (
          <div className="mb-1 flex min-w-0 flex-col items-start gap-1">
            <span className="text-[10px] sm:text-xs text-slate-500">Tarif mulai</span>
            <span className="inline-flex max-w-full min-w-0 flex-col rounded-xl bg-purple-50 px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold leading-tight text-purple-800">
              <span className="max-w-full break-words">{displayedRate ? formatRupiah(displayedRate) : 'Hubungi talent'}</span>
              {displayedRate && <span className="mt-0.5 text-[9px] sm:text-[10px] font-semibold text-purple-600">{showOnlineRate ? '/jam online' : '/jam offline'}</span>}
            </span>
          </div>
        )}

        {talent.headline && (
          <p className="hidden sm:block mt-1.5 text-[13px] sm:text-sm font-medium text-purple-800 line-clamp-1">{talent.headline}</p>
        )}

        {talent.bio && (
          <p className="hidden sm:block mt-1.5 text-[11px] sm:text-xs text-slate-600 line-clamp-1 sm:line-clamp-2 leading-snug">{talent.bio}</p>
        )}

        {talent.interests && talent.interests.length > 0 && (
          <div className="hidden sm:flex mt-2 flex-wrap gap-1">
            {talent.interests.slice(0, 2).map((item) => (
              <span
                key={item}
                className="text-[11px] max-sm:text-[10.5px] font-medium text-purple-800 bg-purple-50 border border-purple-100 px-2 max-sm:px-1.5 py-0.5 rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-1 sm:pt-2">
          <div className="pt-1.5 sm:pt-2 border-t border-purple-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(talent.id);
              }}
              className={`inline-flex w-full sm:w-auto min-h-7 sm:min-h-11 items-center justify-center gap-1 px-2.5 sm:gap-1.5 sm:px-4 py-1 sm:py-2.5 text-[10px] sm:text-xs font-bold text-white bg-gradient-to-r from-purple-700 to-fuchsia-600 group-hover:from-purple-800 group-hover:to-fuchsia-700 rounded-full shadow-md shadow-purple-300/40 transition-all`}
            >
              Lihat Profil
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
