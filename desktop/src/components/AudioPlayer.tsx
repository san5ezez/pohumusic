import React, { useEffect, useRef } from 'react';
import type { Track } from '../types';

interface AudioPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  positionMs: number;
  onPositionUpdate: (posMs: number) => void;
  onTrackEnded: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPositionUpdate,
  onTrackEnded,
}) => {
  const positionRef = useRef(0);

  // Reset position when changing track
  useEffect(() => {
    positionRef.current = 0;
    onPositionUpdate(0);
  }, [currentTrack?.id, onPositionUpdate]);

  // Position ticker: advances time when playing
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;

    const interval = setInterval(() => {
      positionRef.current += 1000;
      onPositionUpdate(positionRef.current);

      const maxDuration = (currentTrack.durationSeconds || 180) * 1000;
      if (positionRef.current >= maxDuration) {
        onTrackEnded();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, onPositionUpdate, onTrackEnded]);

  if (!currentTrack || !isPlaying) return null;

  const isYouTube = currentTrack.provider === 'youtube' || currentTrack.id.startsWith('yt_');
  const ytVideoId = currentTrack.id.replace(/^yt_/, '');

  return (
    <div
      className="fixed -bottom-96 -right-96 w-1 h-1 opacity-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {isYouTube ? (
        <iframe
          key={`yt-${ytVideoId}`}
          src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&enablejsapi=1&playsinline=1`}
          allow="autoplay; encrypted-media"
          title="PohuMusic YouTube Player"
          className="w-1 h-1 border-0"
        />
      ) : (
        <iframe
          key={`sc-${currentTrack.id}`}
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
            currentTrack.externalUrl || currentTrack.permalinkUrl || 'https://soundcloud.com'
          )}&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&show_comments=false&show_playcount=false`}
          allow="autoplay"
          title="PohuMusic SoundCloud Player"
          className="w-1 h-1 border-0"
        />
      )}
    </div>
  );
};
