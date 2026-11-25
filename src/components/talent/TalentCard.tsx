import React, { useState } from 'react';
import { Star, MapPin, ArrowRight, Mic, Video, Image as ImageIcon } from 'lucide-react';
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
  compact?: boolean;
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

export const TalentCard: React.FC<TalentCardProps> = ({ talent, onSelect, availableToday, mediaTypes = [], priceMode = 'all', showPrice = true, compact = false }) => {
  const [imageFailed, setImageFailed] = useState(false);

  const hasVoice = mediaTypes.includes('voice');
  const hasVideo = mediaTypes.includes('video');
  const hasPhoto = mediaTypes.includes('photo');
  const isOnlineOnly = talent.serviceMode === 'Online Only';
  const showOnlineRate = priceMode === 'online' || (priceMode === 'all' && isOnlineOnly);
  const displayedRate = showOnlineRate ? talent.onlineChatRate : talent.hourlyRate;
  const displayedRateLabel = showOnlineRate ? ' / jam online' : ' / jam offline';

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

  if (compact) {
    return (
      <article
        onClick={() => onSelect(talent.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(talent.id);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Lihat profil ${talent.name}`}
        className="group relative min-w-0 overflow-hidden rounded-[22px] bg-white shadow-[0_8px_24px_rgba(64,16,112,0.14)] ring-1 ring-purple-100/80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
          {hasRealPhoto ? (
            <img
              src={talent.avatarUrl}
              alt={`Foto profil ${talent.name}`}
              className="h-full w-full object-cover object-[50%_25%] transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${pickGradient(talent.id)}`}>
              <span className="text-4xl font-black text-white">{initialsOf(talent.name)}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          {isNew && (
            <span className="absolute left-2 top-2 rounded-full bg-[#FFD52A] px-2.5 py-1 text-[11px] font-extrabold text-[#32104F] shadow-sm">
              BARU
            </span>
          )}
          <div className="absolute inset-x-2 bottom-2 text-white">
            <div className="flex items-center justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1">
              <h3 className="min-w-0 flex-1 truncate text-[12px] min-[390px]:text-[13px] font-extrabold leading-tight drop-shadow">
                {talent.name}
              </h3>
              {talent.isVerified === true && <VerifiedBadge />}
              {talent.age && <span className="shrink-0 text-[11px] font-semibold text-white/90">, {talent.age}</span>}
            </div>
              {(talent.reviewCount ?? 0) > 0 && talent.rating !== undefined && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold drop-shadow">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                  {talent.rating.toFixed(1)}
                </span>
              )}
            </div>
            {talent.city && (
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-medium text-white/90">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">{talent.city}</span>
              </p>
            )}
            {talent.distanceKm != null && (
              <p className="mt-0.5 truncate text-[10px] min-[390px]:text-[11px] font-semibold text-emerald-200">± {talent.distanceKm.toFixed(1)} km dari lokasi Anda</p>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => onSelect(talent.id)}
      className="group relative h-full min-w-0 bg-white/95 rounded-xl sm:rounded-[26px] overflow-hidden border border-white shadow-[0_8px_24px_rgba(76,29,149,0.09)] hover:shadow-[0_18px_38px_rgba(76,29,149,0.15)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col ring-1 ring-purple-100/70"
    >
      {/* Media */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
        {hasRealPhoto ? (
          <img
            src={talent.avatarUrl}
            alt={`Foto profil ${talent.name}`}
            className="w-full h-full object-cover object-[50%_22%] group-hover:scale-[1.03] transition-transform duration-500"
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

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/70 to-transparent" />

        {/* Badge BARU tetap di atas; status ketersediaan dipindah ke bawah foto. */}
        {isNew && (
          <div className="absolute top-3 right-3">
            <span className="shrink-0 inline-flex items-center h-[22px] px-2.5 rounded-full bg-amber-400 text-amber-950 text-[9.5px] font-extrabold tracking-widest">
              BARU
            </span>
          </div>
        )}

        {/* Lokasi & mode (bawah foto) */}
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex items-center justify-between text-white text-[10px] sm:text-xs font-medium">
          <span className="inline-flex min-w-0 flex-col">
            {talent.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />{talent.city}</span>}
            {talent.distanceKm != null && <span className="text-[11px] font-semibold text-emerald-200">± {talent.distanceKm.toFixed(1)} km dari Anda</span>}
          </span>
          {talent.serviceMode && (
            <span className="text-[11px] bg-white/20 backdrop-blur-sm border border-white/30 px-2 py-0.5 rounded-full">
              {priceMode === 'online' ? 'Jasa Online' : priceMode === 'offline' ? 'Jasa Offline' : talent.serviceMode}
            </span>
          )}
        </div>
      </div>

      {/* Status ketersediaan dan ikon media: di bawah foto, tidak menimpa gambar */}
      {(availableToday || hasVoice || hasVideo || hasPhoto) && (
        <div className="px-2.5 pt-1 sm:px-5 sm:pt-3 flex flex-wrap gap-1.5">
          {availableToday && (
            <span className="inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-full bg-purple-50 border border-purple-100 text-purple-800 text-[10.5px] font-semibold">
              <span className="relative flex shrink-0 w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-fuchsia-500 opacity-40 animate-ping motion-reduce:animate-none" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-fuchsia-600" />
              </span>
              Tersedia hari ini
            </span>
          )}
          {hasVoice && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-800 bg-fuchsia-50 border border-fuchsia-100 px-2 py-0.5 rounded-full">
              <Mic className="w-3 h-3" /> Voice
            </span>
          )}
          {hasVideo && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              <Video className="w-3 h-3" /> Video
            </span>
          )}
          {hasPhoto && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
              <ImageIcon className="w-3 h-3" /> Foto
            </span>
          )}
        </div>
      )}

      {/* Isi */}
      <div className="p-3.5 pt-3 max-sm:p-2.5 max-sm:pt-2 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <h3 className="font-extrabold text-[#1E0938] text-[14px] sm:text-lg leading-tight group-hover:text-purple-700 transition-colors break-words min-w-0">
            {talent.name}
            {talent.isVerified === true && <VerifiedBadge className="ml-1.5 -mt-0.5" />}
            {talent.age ? <span className="font-semibold text-slate-500">, {talent.age}</span> : null}
          </h3>
          {(talent.reviewCount ?? 0) > 0 && talent.rating !== undefined && (
            <div className="shrink-0 inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs font-bold px-2 py-1 rounded-full tabular-nums">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {talent.rating.toFixed(1)}
              <span className="font-normal text-amber-700/70">({talent.reviewCount})</span>
            </div>
          )}
        </div>

        {talent.headline && (
          <p className="mt-1.5 max-sm:mt-1 text-[13px] sm:text-sm font-medium text-purple-800 line-clamp-1">{talent.headline}</p>
        )}

        {talent.bio && (
          <p className="mt-2 max-sm:mt-1 text-xs text-slate-600 line-clamp-2 leading-snug">{talent.bio}</p>
        )}

        {talent.interests && talent.interests.length > 0 && (
          <div className="mt-2.5 max-sm:mt-1 flex flex-wrap gap-1 max-sm:gap-1">
            {talent.interests.slice(0, 3).map((item) => (
              <span
                key={item}
                className="text-[11px] max-sm:text-[10.5px] font-medium text-purple-800 bg-purple-50 border border-purple-100 px-2 max-sm:px-1.5 py-0.5 rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 max-sm:mt-auto max-sm:pt-1">
          <div className="pt-3 max-sm:pt-1 border-t border-purple-100 flex items-center justify-between gap-3">
            {showPrice && <div>
              <span className="text-[11px] text-slate-400 block font-medium">Mulai dari</span>
              <div className="text-sm sm:text-base font-black text-[#1E0938] tabular-nums leading-tight">
                {displayedRate ? formatRupiah(displayedRate) : 'Hubungi Talent'}
                {displayedRate ? (
                  <span className="block sm:inline text-[10px] sm:text-xs font-medium text-slate-500">{displayedRateLabel}</span>
                ) : null}
              </div>
            </div>}

            <button
              type="button"
              className={`inline-flex min-h-11 items-center gap-1 px-2 sm:gap-1.5 sm:px-4 py-2.5 sm:py-2 ${showPrice ? "text-[10px] sm:text-xs shrink-0" : "w-full justify-center text-xs"} font-bold text-white bg-gradient-to-r from-purple-700 to-fuchsia-600 group-hover:from-purple-800 group-hover:to-fuchsia-700 rounded-full shadow-md shadow-purple-300/40 transition-all`}
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
