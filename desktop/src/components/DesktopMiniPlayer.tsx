import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Maximize2,
  Heart,
} from 'lucide-react';
import type { Track } from '../types';
import { TrackArtwork } from './TrackArtwork';

interface DesktopMiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number; // 0.0 to 1.0
  isShuffle: boolean;
  isRepeat: boolean;
  isFavorite: boolean;
  accentColor: string;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleFavorite: () => void;
  onOpenFullScreen: () => void;
}

export const DesktopMiniPlayer: React.FC<DesktopMiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  positionMs,
  durationMs,
  volume,
  isShuffle,
  isRepeat,
  isFavorite,
  accentColor,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onToggleRepeat,
  onToggleFavorite,
  onOpenFullScreen,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<number | null>(null);

  React.useEffect(() => {
    setIsDragging(false);
    setDragValue(null);
  }, [currentTrack?.id]);

  const totalDuration =
    durationMs > 0 ? durationMs : (currentTrack?.durationSeconds || 180) * 1000;

  const activePosition = isDragging && dragValue !== null ? dragValue : positionMs;
  const currentSec = Math.floor(activePosition / 1000);
  const totalSec = Math.floor(totalDuration / 1000);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="h-20 bg-[#070b13] border-t border-slate-800/80 px-4 flex items-center justify-between gap-4 select-none shrink-0 z-40">
      {/* Track Info (Left) */}
      <div className="flex items-center gap-3 w-72 shrink-0">
        {currentTrack ? (
          <>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
              <TrackArtwork
                artworkUrl={currentTrack.artworkUrl}
                title={currentTrack.title}
                size="sm"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-100 truncate">
                {currentTrack.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {currentTrack.artist}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleFavorite}
              className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
              title="Избранное"
            >
              <Heart
                className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
              />
            </button>
          </>
        ) : (
          <div className="text-xs text-slate-500 italic">Выберите трек для воспроизведения</div>
        )}
      </div>

      {/* Main Playback & Progress Controls (Center) */}
      <div className="flex-1 max-w-2xl flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`p-1.5 rounded transition-colors ${
              isShuffle ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Перемешать"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onPrev}
            className="p-1.5 text-slate-300 hover:text-white transition-colors"
            title="Предыдущий трек"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-950 transition-transform active:scale-95 shadow-md"
            style={{ backgroundColor: accentColor }}
            title={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-slate-950" />
            ) : (
              <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="p-1.5 text-slate-300 hover:text-white transition-colors"
            title="Следующий трек"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleRepeat}
            className={`p-1.5 rounded transition-colors ${
              isRepeat ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Повтор"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Seek Progress Bar */}
        <div className="w-full flex items-center gap-2 text-[11px] font-mono text-slate-500">
          <span>{formatTime(currentSec)}</span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={Math.min(activePosition, totalDuration)}
            onMouseDown={() => {
              setIsDragging(true);
              setDragValue(positionMs);
            }}
            onTouchStart={() => {
              setIsDragging(true);
              setDragValue(positionMs);
            }}
            onChange={(e) => {
              const val = Number(e.target.value);
              setDragValue(val);
            }}
            onMouseUp={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              setIsDragging(false);
              setDragValue(null);
              onSeek(val);
            }}
            onTouchEnd={() => {
              setIsDragging(false);
              if (dragValue !== null) {
                onSeek(dragValue);
              }
              setDragValue(null);
            }}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor }}
          />
          <span>{formatTime(totalSec)}</span>
        </div>
      </div>

      {/* Volume & Fullscreen Button (Right) */}
      <div className="flex items-center justify-end gap-3 w-64 shrink-0">
        <button
          type="button"
          onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
          className="text-slate-400 hover:text-slate-200"
        >
          {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          title={`Громкость: ${Math.round(volume * 100)}%`}
        />

        <button
          type="button"
          onClick={onOpenFullScreen}
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors ml-2"
          title="Полноэкранный плеер"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
