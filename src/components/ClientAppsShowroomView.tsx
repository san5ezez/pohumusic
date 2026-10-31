import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Smartphone,
  GitBranch,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Heart,
  Sliders,
  Maximize2,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
  Keyboard,
  Minus,
  Square,
  X,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import type { Track } from '../types/api';

interface ClientAppsShowroomViewProps {
  tracks: Track[];
  selectedTrack: Track | null;
  onSelectTrack: (track: Track) => void;
}

const ACCENT_COLORS = [
  { name: 'Синий (Яндекс-стиль)', color: '#2563eb' },
  { name: 'Неоновый циан', color: '#06b6d4' },
  { name: 'Изумрудный', color: '#10b981' },
  { name: 'Фиолетовый', color: '#8b5cf6' },
  { name: 'Янтарный', color: '#f59e0b' },
  { name: 'Малиновый', color: '#f43f5e' },
];

export const ClientAppsShowroomView: React.FC<ClientAppsShowroomViewProps> = ({
  tracks,
  selectedTrack,
  onSelectTrack,
}) => {
  const [platformMode, setPlatformMode] = useState<'windows' | 'android' | 'monorepo'>('windows');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [positionMs, setPositionMs] = useState(38000);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [desktopTab, setDesktopTab] = useState<'home' | 'search' | 'library' | 'favorites'>('home');
  const [androidTab, setAndroidTab] = useState<'home' | 'search' | 'library' | 'profile'>('home');
  const [equalizerEnabled, setEqualizerEnabled] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  const activeTrack = selectedTrack || tracks[0] || {
    id: 'sc_1901001',
    provider: 'soundcloud',
    title: 'Northern Lights Echoes',
    artist: 'PohuMusic Collective',
    durationSeconds: 214,
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
    externalUrl: 'https://soundcloud.com/example/northern-lights',
    accessState: 'playable',
    rawPlayCount: 142000,
    displayScore: 71000,
  };

  // In-focus hotkey handler for the showroom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextTrack();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevTrack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, activeTrack]);

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === activeTrack.id);
    if (currentIndex !== -1 && currentIndex + 1 < tracks.length) {
      onSelectTrack(tracks[currentIndex + 1]);
      setPositionMs(0);
      setIsPlaying(true);
    }
  };

  const handlePrevTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === activeTrack.id);
    if (currentIndex > 0) {
      onSelectTrack(tracks[currentIndex - 1]);
      setPositionMs(0);
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Switcher & Accent Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlatformMode('windows')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              platformMode === 'windows'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Windows Desktop (Tauri 2)</span>
          </button>

          <button
            type="button"
            onClick={() => setPlatformMode('android')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              platformMode === 'android'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android (Jetpack Compose + Media3)</span>
          </button>

          <button
            type="button"
            onClick={() => setPlatformMode('monorepo')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              platformMode === 'monorepo'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>GitHub CI/CD (Сборка APK и EXE)</span>
          </button>
        </div>

        {/* Accent Color Customizer */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-400 font-medium">Акцент:</span>
          <div className="flex items-center gap-1.5">
            {ACCENT_COLORS.map((item) => (
              <button
                key={item.color}
                type="button"
                onClick={() => setAccentColor(item.color)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  accentColor === item.color
                    ? 'border-white scale-125 shadow-md'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: item.color }}
                title={item.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* VIEW 1: WINDOWS DESKTOP TAURI 2 FRAMELESS CLIENT */}
      {platformMode === 'windows' && (
        <div
          className={`border border-slate-700/80 rounded-2xl overflow-hidden bg-[#070b13] shadow-2xl transition-all duration-300 flex flex-col ${
            isMaximized ? 'h-[760px]' : 'h-[640px]'
          }`}
        >
          {/* Frameless Custom Window Bar */}
          <div className="h-9 bg-[#050810] border-b border-slate-800 flex items-center justify-between px-3 select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <div
                className="w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-black text-white"
                style={{ backgroundColor: accentColor }}
              >
                P
              </div>
              <span>PohuMusic — Windows Desktop (Tauri 2 + Rust)</span>
            </div>

            <div className="flex items-center h-full">
              <button
                type="button"
                className="h-full px-3 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Свернуть"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsMaximized((m) => !m)}
                className="h-full px-3 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title={isMaximized ? 'Восстановить' : 'Развернуть'}
              >
                {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              </button>
              <button
                type="button"
                className="h-full px-3 hover:bg-rose-600 text-slate-400 hover:text-white"
                title="Закрыть"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Window Body: Sidebar + Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-52 bg-[#090d18] border-r border-slate-800/80 p-3 flex flex-col justify-between shrink-0">
              <div className="space-y-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2">
                  Навигация
                </div>
                <div className="space-y-1">
                  {[
                    { id: 'home', label: 'Главная (Для тебя)' },
                    { id: 'search', label: 'Поиск' },
                    { id: 'library', label: 'Моя музыка' },
                    { id: 'favorites', label: 'Избранное' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDesktopTab(tab.id as any)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        desktopTab === tab.id
                          ? 'text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                      }`}
                      style={
                        desktopTab === tab.id
                          ? { backgroundColor: `${accentColor}25`, color: accentColor }
                          : {}
                      }
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* In-focus Hotkeys Badge */}
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Keyboard className="w-3 h-3 text-blue-400" />
                  <span>Горячие клавиши:</span>
                </div>
                <div className="font-mono text-[10px] text-slate-500">Space: Play/Pause</div>
                <div className="font-mono text-[10px] text-slate-500">→: След. трек</div>
                <div className="font-mono text-[10px] text-slate-500">←: Пред. трек</div>
              </div>
            </aside>

            {/* Central Content Area */}
            <main className="flex-1 bg-[#0c1222] p-5 overflow-y-auto space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {desktopTab === 'home'
                      ? 'Для тебя (Яндекс-стиль)'
                      : desktopTab === 'search'
                      ? 'Поиск треков'
                      : desktopTab === 'library'
                      ? 'Моя музыка (D1)'
                      : 'Избранные треки'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Единый бэкенд Cloudflare Workers · Акцентная тема
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Источник:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                    SoundCloud + YouTube
                  </span>
                </div>
              </div>

              {/* Grid of tracks */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {tracks.slice(0, 8).map((track) => {
                  const isCurrent = activeTrack.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        onSelectTrack(track);
                        setIsPlaying(true);
                      }}
                      className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl p-2.5 cursor-pointer transition-all flex flex-col justify-between"
                    >
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-slate-950">
                        <img
                          src={track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          type="button"
                          className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Play className="w-4 h-4 fill-slate-950 text-slate-950 ml-0.5" />
                        </button>
                      </div>

                      <div>
                        <div
                          className={`text-xs font-semibold truncate ${
                            isCurrent ? 'text-blue-400' : 'text-slate-200'
                          }`}
                        >
                          {track.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {track.artist}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          </div>

          {/* Bottom Desktop Mini-Player */}
          <div className="h-18 bg-[#050810] border-t border-slate-800/80 px-4 py-2 flex items-center justify-between gap-4 select-none shrink-0">
            {/* Track info */}
            <div className="flex items-center gap-3 w-64">
              <img
                src={activeTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}
                alt={activeTrack.title}
                className="w-11 h-11 rounded-lg object-cover bg-slate-800"
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {activeTrack.title}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeTrack.artist}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFavorite((f) => !f)}
                className="text-slate-400 hover:text-rose-500"
              >
                <Heart
                  className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`}
                />
              </button>
            </div>

            {/* Controls & Seek */}
            <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="p-1 text-slate-300 hover:text-white"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-950 transition-transform active:scale-95"
                  style={{ backgroundColor: accentColor }}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-slate-950" />
                  ) : (
                    <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-1 text-slate-300 hover:text-white"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="w-full flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <span>0:38</span>
                <input
                  type="range"
                  min={0}
                  max={(activeTrack?.durationSeconds || 180) * 1000}
                  value={positionMs}
                  onChange={(e) => setPositionMs(Number(e.target.value))}
                  className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor }}
                />
                <span>3:34</span>
              </div>
            </div>

            {/* Volume & Fullscreen */}
            <div className="flex items-center justify-end gap-3 w-52">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor }}
              />
              <button
                type="button"
                onClick={() => setIsFullScreen((f) => !f)}
                className="p-1 text-slate-400 hover:text-white"
                title="Полноэкранный плеер"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: ANDROID SMARTPHONE CLIENT (JETPACK COMPOSE + MEDIA3) */}
      {platformMode === 'android' && (
        <div className="flex justify-center p-4">
          <div className="w-[380px] h-[720px] bg-[#090d16] border-[6px] border-slate-800 rounded-[38px] shadow-2xl overflow-hidden flex flex-col relative select-none">
            {/* Android Status Bar */}
            <div className="h-6 bg-[#070b13] px-6 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>11:24</span>
              <div className="w-16 h-3 bg-slate-900 rounded-full mx-auto" />
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3" />
                <span>100%</span>
              </div>
            </div>

            {/* Screen Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Для тебя</h3>
                  <p className="text-[11px] text-slate-400">Поток треков</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEqualizerEnabled((e) => !e)}
                    className={`p-1.5 rounded-lg border text-xs ${
                      equalizerEnabled
                        ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                        : 'border-slate-800 text-slate-400'
                    }`}
                    title="Эквалайзер (по умолчанию выкл)"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSleepTimerMinutes((m) => (m === null ? 30 : null))
                    }
                    className={`p-1.5 rounded-lg border text-xs ${
                      sleepTimerMinutes !== null
                        ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                        : 'border-slate-800 text-slate-400'
                    }`}
                    title="Таймер сна"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Curated list */}
              <div className="space-y-2">
                {tracks.slice(0, 6).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => {
                      onSelectTrack(track);
                      setIsPlaying(true);
                    }}
                    className="p-2.5 bg-slate-900/70 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80'}
                        alt={track.title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white truncate w-40">
                          {track.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate w-40">
                          {track.artist}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-950"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950 ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Android Compact Mini-Player */}
            <div className="mx-2 mb-1 p-2 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={activeTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=60'}
                  alt={activeTrack.title}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div>
                  <div className="text-[11px] font-semibold text-white truncate w-32">
                    {activeTrack.title}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate w-32">
                    {activeTrack.artist}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-950"
                  style={{ backgroundColor: accentColor }}
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3 fill-slate-950" />
                  ) : (
                    <Play className="w-3 h-3 fill-slate-950 ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-1 text-slate-300"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Android Bottom Navigation Bar */}
            <div className="h-14 bg-[#070b13] border-t border-slate-800/80 px-4 flex items-center justify-around text-[10px]">
              {[
                { id: 'home', label: 'Главная' },
                { id: 'search', label: 'Поиск' },
                { id: 'library', label: 'Моя музыка' },
                { id: 'profile', label: 'Профиль' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setAndroidTab(b.id as any)}
                  className="flex flex-col items-center gap-0.5"
                  style={{
                    color: androidTab === b.id ? accentColor : '#94a3b8',
                  }}
                >
                  <span className="font-semibold">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: GITHUB MONOREPO CI/CD ARCHITECTURE */}
      {platformMode === 'monorepo' && (
        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-6 space-y-6 font-mono text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-sans">
              <Package className="w-5 h-5 text-blue-400" />
              <span>Единый репозиторий PohuMusic: Backend + Android APK + Windows EXE</span>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px]">
              CI/CD Workflows Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="text-blue-400 font-bold font-sans">1. Cloudflare Workers</div>
              <div className="text-slate-400 text-[11px]">
                Директория: <code className="text-slate-200">workers/</code>
              </div>
              <p className="text-slate-300 font-sans text-xs">
                Независимый масштабируемый Backend на Hono + D1 + KV. Все данные пользователей хранятся в D1.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="text-emerald-400 font-bold font-sans">2. Android Client</div>
              <div className="text-slate-400 text-[11px]">
                Директория: <code className="text-slate-200">android/</code>
              </div>
              <p className="text-slate-300 font-sans text-xs">
                Kotlin + Jetpack Compose + Media3. Сборка через Gradle: <code className="text-amber-400">assembleDebug</code> и <code className="text-amber-400">assembleRelease</code>.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="text-purple-400 font-bold font-sans">3. Windows Desktop Client</div>
              <div className="text-slate-400 text-[11px]">
                Директория: <code className="text-slate-200">desktop/</code>
              </div>
              <p className="text-slate-300 font-sans text-xs">
                Tauri 2 + React + Rust. Сборка инсталлятора <code className="text-amber-400">.exe</code> (NSIS) и portable-сборки на <code className="text-slate-200">windows-latest</code>.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="text-slate-300 font-bold font-sans text-xs">
              GitHub Actions Workflow: <span className="text-amber-400">.github/workflows/build-all.yml</span>
            </div>
            <p className="text-slate-400 font-sans text-xs">
              При каждом пуше в <code className="text-slate-200">main</code> или создании тега релиза (например <code className="text-slate-200">v1.0.0</code>) GitHub автоматически:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 font-sans text-xs">
              <li>Тестирует Backend и D1 миграции, деплоит в Cloudflare Workers;</li>
              <li>Собирает Android Debug и Release APK и загружает их в артефакты;</li>
              <li>Запускает Windows-раннер, собирает Tauri 2 и генерирует установщик <code className="text-blue-400">.exe</code>;</li>
              <li>Публикует общий GitHub Release со всеми готовыми файлами для скачивания.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
