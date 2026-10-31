import React, { useState } from 'react';
import { Music } from 'lucide-react';

interface TrackArtworkProps {
  artworkUrl?: string | null;
  title: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TrackArtwork: React.FC<TrackArtworkProps> = ({
  artworkUrl,
  title,
  className = 'w-full h-full object-cover',
  size = 'md',
}) => {
  const [hasError, setHasError] = useState(false);

  // Generate deterministic beautiful gradient based on track title
  const getGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 45) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 60%, 22%) 0%, hsl(${hue2}, 70%, 14%) 100%)`;
  };

  if (!artworkUrl || hasError) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none"
        style={{ background: getGradient(title || 'PohuMusic') }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <Music
          className={`relative z-10 text-white/70 ${
            size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-12 h-12' : 'w-7 h-7'
          }`}
        />
        {size !== 'sm' && (
          <span className="relative z-10 text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1 px-1 truncate max-w-[90%]">
            PohuMusic
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={artworkUrl}
      alt=""
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
