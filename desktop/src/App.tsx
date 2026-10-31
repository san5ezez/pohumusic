import React, { useState, useEffect, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { DesktopMiniPlayer } from './components/DesktopMiniPlayer';
import { DesktopFullScreenPlayer } from './components/DesktopFullScreenPlayer';
import { HotkeyConfigModal } from './components/HotkeyConfigModal';
import { SplashScreen } from './components/SplashScreen';
import { API_BASE_URL } from './config/api';
import type { Track, HotkeyConfig, Playlist, HistoryItem } from './types';
import {
  Play,
  Sparkles,
  WifiOff,
  Search as SearchIcon,
  Plus,
  Share2,
} from 'lucide-react';

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHotkeyModalOpen, setIsHotkeyModalOpen] = useState(false);

  // Playback state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['sc_1901001']));

  // Library state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendationMode, setRecommendationMode] = useState('working');

  // Hotkey settings
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>({
    playPause: 'Space',
    nextTrack: 'ArrowRight',
    prevTrack: 'ArrowLeft',
    volumeUp: 'ArrowUp',
    volumeDown: 'ArrowDown',
  });

  // Network offline listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch initial tracks & library data from Cloudflare Workers backend
  const loadInitialData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/search?limit=30`);
      if (res.ok) {
        const data = await res.json();
        const list = (data.tracks || []) as Track[];
        setTracks(list);
        if (list.length > 0 && !currentTrack) {
          setCurrentTrack(list[0]);
        }
      }

      // Load sample playlists & history
      const plRes = await fetch(`${API_BASE_URL}/playlists`);
      if (plRes.ok) {
        const pData = await plRes.json();
        setPlaylists((pData.playlists || []) as Playlist[]);
      }
    } catch (_: unknown) {
      // Offline or network error handled gracefully
    } finally {
      setTimeout(() => setIsLoading(false), 600);
    }
  }, [currentTrack]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // In-focus hotkey listeners (Only active when window has focus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger hotkeys if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === hotkeys.playPause) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === hotkeys.nextTrack) {
        e.preventDefault();
        handleNext();
      } else if (e.code === hotkeys.prevTrack) {
        e.preventDefault();
        handlePrev();
      } else if (e.code === hotkeys.volumeUp) {
        e.preventDefault();
        setVolume((v) => Math.min(1, v + 0.05));
      } else if (e.code === hotkeys.volumeDown) {
        e.preventDefault();
        setVolume((v) => Math.max(0, v - 0.05));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, tracks, currentTrack]);

  const handleNext = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx !== -1 && idx + 1 < tracks.length) {
      setCurrentTrack(tracks[idx + 1]);
      setPositionMs(0);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      setCurrentTrack(tracks[idx - 1]);
      setPositionMs(0);
      setIsPlaying(true);
    }
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Custom Frameless Windows TitleBar */}
      <TitleBar />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor={accentColor}
          onOpenHotkeys={() => setIsHotkeyModalOpen(true)}
          playlistsCount={playlists.length}
        />

        {/* Central Content Area */}
        <main className="flex-1 bg-[#0c1222] overflow-y-auto p-6 space-y-6">
          {/* Offline Warning Banner */}
          {isOffline && (
            <div className="p-3 bg-amber-950/70 border border-amber-800 rounded-xl flex items-center gap-3 text-xs text-amber-200">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Отсутствует подключение к сети. Воспроизведение треков и синхронизация приостановлены.
              </span>
            </div>
          )}

          {/* Tab 1: Home / For You */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Для тебя</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Персональный поток на основе алгоритма рекомендаций PohuMusic
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Режим:</span>
                  {['working', 'commuting', 'workout', 'calm'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRecommendationMode(mode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        recommendationMode === mode
                          ? 'text-white'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                      style={
                        recommendationMode === mode
                          ? { backgroundColor: accentColor }
                          : {}
                      }
                    >
                      {mode === 'working'
                        ? 'Работа'
                        : mode === 'commuting'
                        ? 'В дороге'
                        : mode === 'workout'
                        ? 'Спорт'
                        : 'Спокойствие'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Curated Grid of Tracks */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {tracks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        setCurrentTrack(track);
                        setIsPlaying(true);
                      }}
                      className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between"
                    >
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-slate-950">
                        <img
                          src={track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          type="button"
                          className="absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
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
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {track.artist}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-mono">
                          {track.provider}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Search */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="relative max-w-lg">
                <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Искать треки, альбомы, исполнителей..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="divide-y divide-slate-800/80">
                {tracks
                  .filter((t) =>
                    !searchQuery
                      ? true
                      : t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.artist.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        setCurrentTrack(track);
                        setIsPlaying(true);
                      }}
                      className="py-2.5 px-3 hover:bg-slate-900/60 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80'}
                          alt={track.title}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {track.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {track.artist} · {track.provider}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs font-mono text-slate-500">
                        {Math.floor(track.durationSeconds / 60)}:
                        {String(track.durationSeconds % 60).padStart(2, '0')}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tab 3: Playlists (Max 10) */}
          {activeTab === 'playlists' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Плейлисты ({playlists.length}/10)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Ограничение бизнес-логики: не более 10 плейлистов на аккаунт в Cloudflare D1
                  </p>
                </div>

                <button
                  type="button"
                  disabled={playlists.length >= 10}
                  onClick={() => {
                    const newPl: Playlist = {
                      id: `pl_${Date.now()}`,
                      userId: 'usr_sanchez',
                      title: `Плейлист #${playlists.length + 1}`,
                      isPublic: false,
                      tracksCount: 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setPlaylists((prev) => [...prev, newPl]);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 text-slate-950"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать плейлист</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2"
                  >
                    <div className="text-sm font-semibold text-white">{pl.title}</div>
                    <div className="text-xs text-slate-400">
                      {pl.tracksCount} треков · {pl.isPublic ? 'Публичный' : 'Приватный'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Profile & Settings */}
          {activeTab === 'profile' && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Профиль и оформление</h2>
                <p className="text-xs text-slate-400">
                  Настройки Windows Desktop клиента и выбор акцентного цвета
                </p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  Акцентный цвет оформления
                </div>
                <div className="flex gap-3">
                  {[
                    { label: 'Синий', color: '#2563eb' },
                    { label: 'Циан', color: '#06b6d4' },
                    { label: 'Изумруд', color: '#10b981' },
                    { label: 'Фиолетовый', color: '#8b5cf6' },
                    { label: 'Янтарь', color: '#f59e0b' },
                    { label: 'Роза', color: '#f43f5e' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setAccentColor(c.color)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        accentColor === c.color
                          ? 'border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
                <div className="text-slate-400">API Endpoint:</div>
                <div className="text-slate-200 break-all">{API_BASE_URL}</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. Bottom Playback Panel */}
      <DesktopMiniPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        positionMs={positionMs}
        durationMs={(currentTrack?.durationSeconds || 180) * 1000}
        volume={volume}
        isShuffle={isShuffle}
        isRepeat={isRepeat}
        isFavorite={currentTrack ? favorites.has(currentTrack.id) : false}
        accentColor={accentColor}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={setPositionMs}
        onVolumeChange={setVolume}
        onToggleShuffle={() => setIsShuffle((s) => !s)}
        onToggleRepeat={() => setIsRepeat((r) => !r)}
        onToggleFavorite={() => currentTrack && toggleFavorite(currentTrack.id)}
        onOpenFullScreen={() => setIsFullScreen(true)}
      />

      {/* 4. FullScreen Modal Player */}
      {isFullScreen && currentTrack && (
        <DesktopFullScreenPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          positionMs={positionMs}
          durationMs={(currentTrack.durationSeconds || 180) * 1000}
          isShuffle={isShuffle}
          isRepeat={isRepeat}
          isFavorite={favorites.has(currentTrack.id)}
          accentColor={accentColor}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={setPositionMs}
          onToggleShuffle={() => setIsShuffle((s) => !s)}
          onToggleRepeat={() => setIsRepeat((r) => !r)}
          onToggleFavorite={() => toggleFavorite(currentTrack.id)}
          onRecommendSimilar={() => {}}
          onClose={() => setIsFullScreen(false)}
        />
      )}

      {/* 5. Hotkeys Configuration Modal */}
      {isHotkeyModalOpen && (
        <HotkeyConfigModal
          config={hotkeys}
          onSave={setHotkeys}
          onClose={() => setIsHotkeyModalOpen(false)}
        />
      )}
    </div>
  );
}
