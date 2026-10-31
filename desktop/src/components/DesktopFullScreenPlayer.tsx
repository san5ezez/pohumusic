import React from 'react';
import {
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Sparkles,
} from 'lucide-react';
import type { Track } from '../types';
import { TrackArtwork } from './TrackArtwork';

interface DesktopFullScreenPlayerProps {
  track: Track;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isShuffle: boolean;
  isRepeat: boolean;
  isFavorite: boolean;
  accentColor: string;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (positionMs: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleFavorite: () => void;
  onRecommendSimilar: () => void;
  onClose: () => void;
}

export const DesktopFullScreenPlayer: React.FC<DesktopFullScreenPlayerProps> = ({
  track,
  isPlaying,
  positionMs,
  durationMs,
  isShuffle,
  isRepeat,
  isFavorite,
  accentColor,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleFavorite,
  onRecommendSimilar,
  onClose,
}) => {
  const totalDuration =
    durationMs > 0 ? durationMs : (track.durationSeconds || 180) * 1000;

  const currentSec = Math.floor(positionMs / 1000);
  const totalSec = Math.floor(totalDuration / 1000);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#0e172a] via-[#090d16] to-[#050811] z-50 flex flex-col justify-between p-8 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <span>Слушаете через {track.provider === 'soundcloud' ? 'SoundCloud' : 'YouTube'}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
          title="Свернуть полноэкранный режим"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Center Artwork & Track Details */}
      <div className="flex flex-col items-center justify-center gap-6 my-auto max-w-xl mx-auto text-center">
        <div className="w-80 h-80 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-slate-800">
          <TrackArtwork
            artworkUrl={track.artworkUrl}
            title={track.title}
            size="lg"
          />
        </div>

        <div className="space-y-1 w-full">
          <h2 className="text-2xl font-bold text-white truncate">{track.title}</h2>
          <p className="text-base text-slate-400 truncate">{track.artist}</p>
        </div>

        <button
          type="button"
          onClick={onRecommendSimilar}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 text-xs text-slate-300 flex items-center gap-2 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Рекомендовать похожее</span>
        </button>
      </div>

      {/* Bottom Controls */}
      <div className="max-w-2xl mx-auto w-full space-y-4">
        {/* Seek Bar */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={positionMs}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs font-mono text-slate-500">
            <span>{formatTime(currentSec)}</span>
            <span>{formatTime(totalSec)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={onToggleFavorite}
            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onToggleShuffle}
            className={`p-2 transition-colors ${
              isShuffle ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onPrev}
            className="p-2 text-slate-200 hover:text-white"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            className="w-14 h-14 rounded-full flex items-center justify-center text-slate-950 shadow-xl transition-transform active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-slate-950" />
            ) : (
              <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="p-2 text-slate-200 hover:text-white"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={onToggleRepeat}
            className={`p-2 transition-colors ${
              isRepeat ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Repeat className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
