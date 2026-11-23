import React from 'react';
import { Check } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

/** Lencana centang "Terverifikasi" yang diletakkan di samping nama talent. */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 'sm', className = '' }) => (
  <span
    role="img"
    aria-label="Terverifikasi"
    title="Identitas terverifikasi"
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#6D45D9] text-white align-middle shadow-none ${
      size === 'md' ? 'w-5 h-5' : 'w-[18px] h-[18px]'
    } ${className}`}
  >
    <Check className={size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5'} strokeWidth={3} />
  </span>
);
