import { useState, useEffect, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { DesktopMiniPlayer } from './components/DesktopMiniPlayer';
import { DesktopFullScreenPlayer } from './components/DesktopFullScreenPlayer';
import { HotkeyConfigModal } from './components/HotkeyConfigModal';
import { SplashScreen } from './components/SplashScreen';
import { AuthModal } from './components/AuthModal';
import { TrackArtwork } from './components/TrackArtwork';
import { AudioPlayer } from './components/AudioPlayer';
import { API_BASE_URL } from './config/api';
import type { Track, HotkeyConfig, Playlist, User } from './types';
import {
  Play,
  WifiOff,
  Search as SearchIcon,
  Plus,
  LogIn,
  LogOut,
  User as UserIcon,
  Shield,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function normalizeTrack(raw: any): Track {
  const durationSeconds =
    typeof raw.durationSeconds === 'number'
      ? raw.durationSeconds
      : typeof raw.durationMs === 'number'
      ? Math.round(raw.durationMs / 1000)
      : 180;

  const artist = raw.artist || raw.artistName || 'PohuMusic Artist';
  const rawArtwork = raw.artworkUrl || '';
  const artworkUrl =
    rawArtwork && !rawArtwork.startsWith('http') && !rawArtwork.startsWith('data:')
      ? `https://pohumusic-backend.4g-2551.workers.dev${rawArtwork.startsWith('/') ? '' : '/'}${rawArtwork}`
      : rawArtwork;

  const externalUrl = raw.externalUrl || raw.permalinkUrl || '';
  const album = raw.album || raw.albumTitle || undefined;

  return {
    id: String(raw.id || raw.providerTrackId || Math.random().toString(36).substring(7)),
    provider: raw.provider || 'soundcloud',
    title: raw.title || 'Без названия',
    artist,
    artistName: raw.artistName || artist,
    album,
    albumTitle: raw.albumTitle || album,
    durationSeconds,
    durationMs: raw.durationMs || durationSeconds * 1000,
    artworkUrl,
    externalUrl,
    permalinkUrl: raw.permalinkUrl || externalUrl,
    accessState: raw.accessState || 'playable',
    rawPlayCount: raw.rawPlayCount,
    displayScore: raw.displayScore,
  };
}

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHotkeyModalOpen, setIsHotkeyModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pohumusic_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('pohumusic_access_token');
  });

  // Profile management state
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [profileActionStatus, setProfileActionStatus] = useState<string | null>(null);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);

  // Playback state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Library state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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

  const handleAuthSuccess = (user: User, access: string, refresh: string) => {
    setCurrentUser(user);
    setAccessToken(access);
    try {
      localStorage.setItem('pohumusic_user', JSON.stringify(user));
      localStorage.setItem('pohumusic_access_token', access);
      localStorage.setItem('pohumusic_refresh_token', refresh);
    } catch {}
    loadUserData(access);
  };

  const handleLogout = async () => {
    if (accessToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {}
    }
    setCurrentUser(null);
    setAccessToken(null);
    setPlaylists([]);
    setFavorites(new Set());
    try {
      localStorage.removeItem('pohumusic_user');
      localStorage.removeItem('pohumusic_access_token');
      localStorage.removeItem('pohumusic_refresh_token');
    } catch {}
  };

  // Load user-specific library data (playlists & favorites)
  const loadUserData = useCallback(async (token: string) => {
    try {
      const authHeaders = { Authorization: `Bearer ${token}` };
      const [meRes, plRes, favRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/playlists`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/library/favorites`, { headers: authHeaders }),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
        try {
          localStorage.setItem('pohumusic_user', JSON.stringify(meData.user));
        } catch {}
      } else if (meRes.status === 401) {
        handleLogout();
        return;
      }

      if (plRes.ok) {
        const pData = await plRes.json();
        setPlaylists((pData.playlists || []) as Playlist[]);
      }

      if (favRes.ok) {
        const fData = await favRes.json();
        const favIds = new Set<string>(
          (fData.favorites || []).map((f: any) => f.trackId || f.id)
        );
        setFavorites(favIds);
      }
    } catch {}
  }, []);

  // Fetch initial tracks & catalog
  const loadInitialData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/search?limit=30`);
      if (res.ok) {
        const data = await res.json();
        const list = ((data.tracks || []) as any[]).map(normalizeTrack);
        setTracks(list);
        if (list.length > 0) {
          setCurrentTrack((prev) => prev ?? list[0]);
        }
      }

      if (accessToken) {
        await loadUserData(accessToken);
      }
    } catch (_: unknown) {
      // Offline or network error handled gracefully
    } finally {
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [accessToken, loadUserData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Debounced search against Cloudflare Workers API
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(
          `${API_BASE_URL}/tracks/search?q=${encodeURIComponent(trimmed)}&limit=50`
        );
        if (res.ok) {
          const data = await res.json();
          const list = ((data.tracks || []) as any[]).map(normalizeTrack);
          setSearchResults(list);
        }
      } catch (e) {
        console.error('Failed to search tracks', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const currentQueue =
    activeTab === 'search' && searchResults.length > 0 ? searchResults : tracks;

  const handleNext = () => {
    if (!currentTrack || currentQueue.length === 0) return;
    const idx = currentQueue.findIndex((t) => t.id === currentTrack.id);
    if (idx !== -1 && idx + 1 < currentQueue.length) {
      setCurrentTrack(currentQueue[idx + 1]);
      setPositionMs(0);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (!currentTrack || currentQueue.length === 0) return;
    const idx = currentQueue.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      setCurrentTrack(currentQueue[idx - 1]);
      setPositionMs(0);
      setIsPlaying(true);
    }
  };

  const toggleFavorite = async (trackId: string) => {
    if (!accessToken) {
      setIsAuthModalOpen(true);
      return;
    }

    const isFav = favorites.has(trackId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });

    try {
      if (isFav) {
        await fetch(`${API_BASE_URL}/library/favorites/${encodeURIComponent(trackId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } else {
        await fetch(`${API_BASE_URL}/library/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ trackId }),
        });
      }
    } catch {}
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsernameInput.trim() || !accessToken) return;
    setProfileActionStatus(null);
    setProfileActionError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username: newUsernameInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Не удалось обновить никнейм');
      }
      setCurrentUser(data.user);
      try {
        localStorage.setItem('pohumusic_user', JSON.stringify(data.user));
      } catch {}
      setNewUsernameInput('');
      setProfileActionStatus(
        'Никнейм успешно обновлен! (Следующее изменение доступно через 7 дней)'
      );
    } catch (err: any) {
      setProfileActionError(err.message || 'Ошибка обновления никнейма');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!accessToken) {
      setIsAuthModalOpen(true);
      return;
    }
    const title = window.prompt('Название нового плейлиста:');
    if (!title || !title.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        setPlaylists((prev) => [data.playlist, ...prev]);
      } else {
        alert(data.error?.message || 'Ошибка создания плейлиста');
      }
    } catch {
      alert('Ошибка соединения при создании плейлиста');
    }
  };

  const searchList = searchQuery.trim() ? searchResults : tracks;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c15] text-slate-100 select-none overflow-hidden font-sans">
      {/* 0. Splash Screen while loading */}
      {isLoading && <SplashScreen statusMessage="Подключение к PohuMusic Cloudflare Workers..." />}

      {/* 1. Custom Frameless Titlebar */}
      <TitleBar />

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-600/90 text-slate-950 px-4 py-1 text-xs font-semibold flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Режим офлайн: подключение к Cloudflare Workers временно недоступно</span>
        </div>
      )}

      {/* 2. Main App Body (Sidebar + Content Workspace) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor={accentColor}
          onOpenHotkeys={() => setIsHotkeyModalOpen(true)}
          playlistsCount={playlists.length}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-6 pb-28">
          {/* Tab 1: Home / Discovery */}
          {activeTab === 'home' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Рекомендации</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Умный подбор музыки на основе настроения и предпочтений
                </p>
              </div>

              {/* Mode Selector */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'waking_up', label: 'Просыпаюсь' },
                  { id: 'on_the_road', label: 'В дороге' },
                  { id: 'working', label: 'Работаю' },
                  { id: 'training', label: 'Тренируюсь' },
                  { id: 'falling_asleep', label: 'Засыпаю' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRecommendationMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      recommendationMode === m.id
                        ? 'text-white shadow-md'
                        : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                    style={
                      recommendationMode === m.id
                        ? { backgroundColor: accentColor }
                        : {}
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Tracks Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tracks.map((t) => {
                  const isCurrent = currentTrack?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setCurrentTrack(t);
                        setPositionMs(0);
                        setIsPlaying(true);
                      }}
                      className={`group p-3 rounded-xl cursor-pointer transition-all border ${
                        isCurrent
                          ? 'bg-slate-800/80 border-slate-700 shadow-lg'
                          : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/60'
                      }`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-950 mb-3 group-hover:scale-[1.02] transition-transform duration-300">
                        <TrackArtwork artworkUrl={t.artworkUrl} title={t.title} />
                        <button
                          type="button"
                          className="absolute bottom-2 right-2 p-2.5 rounded-full bg-blue-600 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="font-semibold text-xs text-white truncate">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {t.artist}
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
            <div className="space-y-6 max-w-4xl">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Поиск музыки</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Единый поиск по SoundCloud и YouTube
                </p>
              </div>

              <div className="relative">
                <SearchIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Исполнитель, трек или альбом..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {isSearching && (
                  <div className="absolute right-3.5 top-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {searchList.map((t) => {
                  const isCurrent = currentTrack?.id === t.id;
                  const durSec = t.durationSeconds || Math.round((t.durationMs || 0) / 1000) || 0;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setCurrentTrack(t);
                        setPositionMs(0);
                        setIsPlaying(true);
                      }}
                      className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-slate-800/90 border-blue-500/50 shadow-md'
                          : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-10 h-10 rounded-lg bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center">
                          <TrackArtwork
                            artworkUrl={t.artworkUrl}
                            title={t.title}
                            size="sm"
                          />
                        </div>
                        <div className="truncate">
                          <div className={`text-xs font-semibold truncate ${isCurrent ? 'text-blue-400' : 'text-white'}`}>
                            {t.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                            <span>{t.artist || t.artistName || 'Неизвестный исполнитель'}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {t.provider}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 shrink-0 ml-4">
                        {Math.floor(durSec / 60)}:
                        {String(durSec % 60).padStart(2, '0')}
                      </div>
                    </div>
                  );
                })}

                {!isSearching && searchQuery.trim() !== '' && searchResults.length === 0 && (
                  <div className="text-center py-16 bg-slate-900/20 border border-slate-800/40 rounded-2xl">
                    <SearchIcon className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
                    <p className="text-sm font-medium text-slate-400">
                      Ничего не найдено по запросу «{searchQuery.trim()}»
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Попробуйте ввести другое имя исполнителя или название песни
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: My Library */}
          {activeTab === 'library' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Моя музыка</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    {currentUser
                      ? `Персональная коллекция пользователя @${currentUser.username}`
                      : 'Войдите в аккаунт, чтобы сохранять свои плейлисты'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreatePlaylist}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-transform active:scale-95"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать плейлист</span>
                </button>
              </div>

              {!currentUser && (
                <div className="p-4 bg-blue-950/40 border border-blue-900/60 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-blue-200">
                      Синхронизация библиотеки отключена
                    </div>
                    <div className="text-[11px] text-blue-300/80">
                      Войдите или зарегистрируйтесь, чтобы создавать до 10 плейлистов и синхронизировать их с мобильным приложением.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shrink-0 shadow-md transition-colors"
                  >
                    Войти
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="text-sm font-semibold text-white">{pl.title}</div>
                    <div className="text-xs text-slate-400">
                      {pl.tracksCount} треков · {pl.isPublic ? 'Публичный' : 'Приватный'}
                    </div>
                  </div>
                ))}
                {playlists.length === 0 && currentUser && (
                  <div className="col-span-full p-8 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                    У вас пока нет плейлистов. Нажмите «Создать плейлист», чтобы добавить первый.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Profile & Settings */}
          {activeTab === 'profile' && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Профиль и настройки</h2>
                <p className="text-xs text-slate-400">
                  Управление аккаунтом, внешним видом и подключением к бэкенду
                </p>
              </div>

              {/* User Account Card */}
              {currentUser ? (
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white shadow-lg"
                        style={{ backgroundColor: accentColor }}
                      >
                        {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          {currentUser.displayName || currentUser.username}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          @{currentUser.username}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        {currentUser.role === 'admin'
                          ? 'Администратор'
                          : currentUser.role === 'moderator'
                          ? 'Модератор'
                          : 'Пользователь'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Email адрес:</span>
                      <span className="text-slate-200 font-mono">{currentUser.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Статус почты:</span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          currentUser.emailVerified ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {currentUser.emailVerified ? 'Подтверждён' : 'Ожидает подтверждения'}
                      </span>
                    </div>
                  </div>

                  {/* Change Nickname (Section 8: once every 7 days rule) */}
                  <form onSubmit={handleUpdateUsername} className="pt-3 border-t border-slate-800/80 space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Смена никнейма (доступно раз в 7 дней)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUsernameInput}
                        onChange={(e) => setNewUsernameInput(e.target.value)}
                        placeholder="Новый никнейм..."
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={!newUsernameInput.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-md disabled:opacity-40 transition-transform active:scale-95"
                        style={{ backgroundColor: accentColor }}
                      >
                        Сохранить
                      </button>
                    </div>
                    {profileActionStatus && (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{profileActionStatus}</span>
                      </div>
                    )}
                    {profileActionError && (
                      <div className="text-[11px] text-red-400 flex items-center gap-1.5 mt-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{profileActionError}</span>
                      </div>
                    )}
                  </form>

                  <div className="pt-3 border-t border-slate-800/80 flex justify-end">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/60 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Выйти из аккаунта</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Вход не выполнен</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Войдите в существующий аккаунт или зарегистрируйтесь, чтобы управлять своей музыкой.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-lg transition-transform active:scale-95"
                    style={{ backgroundColor: accentColor }}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Войти / Зарегистрироваться</span>
                  </button>
                </div>
              )}

              {/* Accent Color Chooser */}
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

              {/* Canonical API Endpoint Box */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
                <div className="text-slate-400">API Endpoint:</div>
                <div className="text-slate-200 break-all select-all">{API_BASE_URL}</div>
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

      {/* Audio Engine */}
      <AudioPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        volume={volume}
        positionMs={positionMs}
        onPositionUpdate={setPositionMs}
        onTrackEnded={handleNext}
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

      {/* 6. Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        accentColor={accentColor}
      />
    </div>
  );
}
