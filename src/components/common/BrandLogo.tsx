import React from 'react';
import { useBranding } from '../../utils/branding';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  variant?: 'full' | 'icon';
  inverted?: boolean;
  className?: string;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showTagline = true,
  variant = 'full',
  inverted = false,
  className = '',
  onClick,
}) => {
  const { logoUrl, iconUrl, isLoaded } = useBranding();
  const visibilityClass = isLoaded ? '' : 'invisible';
  const heightClasses = {
    sm: 'h-8',
    md: 'h-14',
    lg: 'h-18',
    xl: 'h-24',
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-16 h-16',
  };

  if (variant === 'icon') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center shrink-0 select-none ${
          onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
        } ${className}`}
      >
        <img
          src={iconUrl}
          alt="YUKU"
          className={`${iconSizes[size]} object-contain ${visibilityClass}`}
          loading="eager"
        />
      </div>
    );
  }

  // On dark surfaces (e.g. Footer & dark banners), display the authentic logo inside
  // a crisp, refined white surface badge to preserve 100% of the authentic brand colors
  if (inverted) {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center select-none ${
          onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
        } ${className}`}
      >
        <div className="bg-white/95 rounded-2xl px-3.5 py-2 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.38)] ring-1 ring-white/70 inline-flex items-center border border-white/80 backdrop-blur-xl">
          <img
            src={logoUrl}
            alt="YUKU — Real Friends. Real Moments."
            className={`${heightClasses[size]} w-auto object-contain block ${visibilityClass}`}
            loading="eager"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center select-none ${
        onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      } ${className}`}
    >
      <img
        src={logoUrl}
        alt="YUKU — Real Friends. Real Moments."
        className={`${heightClasses[size]} w-auto object-contain block ${visibilityClass}`}
        loading="eager"
      />
    </div>
  );
};
