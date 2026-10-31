import React, { useEffect, useState, useCallback } from 'react';
import { CatalogPlayerView } from './components/CatalogPlayerView';
import {
  RecommendationsView,
  type RecommendationItem,
  type SimilarTrackItem,
} from './components/RecommendationsView';
import { LibrarySyncView } from './components/LibrarySyncView';
import { ApiAuditWorkbenchView } from './components/ApiAuditWorkbenchView';
import { AdminConsoleView } from './components/AdminConsoleView';
import { ClientAppsShowroomView } from './components/ClientAppsShowroomView';
import type {
  PlaybackInfo,
  PlayerDeviceSession,
  ProviderSource,
  Track,
} from './types/api';

type ActiveTab = 'catalog' | 'recommendations' | 'library' | 'workbench' | 'admin' | 'clients';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');

  // Demo Session Tokens (Admin vs Listener)
  const [adminToken, setAdminToken] = useState<string>('');
  const [listenerToken, setListenerToken] = useState<string>('');
  const [activeRoleMode, setActiveRoleMode] = useState<'admin' | 'user'>('admin');
  const [defaultShareId, setDefaultShareId] = useState<string>('pohuNight26');

  const currentToken = activeRoleMode === 'admin' ? adminToken : listenerToken;

  // Catalog & Player state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | ProviderSource>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playbackInfo, setPlaybackInfo] = useState<PlaybackInfo | null>(null);
  const [activeSession, setActiveSession] = useState<PlayerDeviceSession | null>(null);
  const [devices, setDevices] = useState<PlayerDeviceSession[]>([]);
  const [syncConflictNotice, setSyncConflictNotice] = useState<string | null>(null);

  // Recommendations state
  const [recActivity, setRecActivity] = useState('working');
  const [recCharacter, setRecCharacter] = useState('favorite');
  const [recMood, setRecMood] = useState('calm');
  const [recLanguage, setRecLanguage] = useState('any');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [similarSeedTrack, setSimilarSeedTrack] = useState<Track | null>(null);
  const [similarTracks, setSimilarTracks] = useState<SimilarTrackItem[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  // Library & Profile state
  const [playlists, setPlaylists] = useState<Array<any>>([]);
  const [favorites, setFavorites] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sharedPlaylistPreview, setSharedPlaylistPreview] = useState<Record<string, any> | null>(
    null
  );
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);

  // Health & Admin state
  const [healthInfo, setHealthInfo] = useState<Record<string, any> | null>(null);
  const [adminStats, setAdminStats] = useState<Record<string, any> | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<any>>([]);
  const [adminErrors, setAdminErrors] = useState<Array<any>>([]);
  const [adminSettings, setAdminSettings] = useState<Array<any>>([]);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init.headers as Record<string, string>) || {}),
      };
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }
      return fetch(path, { ...init, headers });
    },
    [currentToken]
  );

  const loadCatalog = useCallback(
    async (q: string, prov: 'all' | ProviderSource, acc: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('provider', prov);
      if (acc !== 'all') params.set('access', acc);

      const res = await fetch(`/api/v1/tracks/search?${params.toString()}`);
      const data = await res.json();
      const list = (data.tracks || []) as Track[];
      setTracks(list);
      if (list.length > 0 && !selectedTrack) {
        const first = list[0];
        setSelectedTrack(first);
        const pbRes = await fetch(`/api/v1/tracks/${encodeURIComponent(first.id)}`);
        if (pbRes.ok) {
          const pbData = await pbRes.json();
          setPlaybackInfo(pbData.playback);
        }
      }
    },
    [selectedTrack]
  );

  const loadRecommendations = useCallback(
    async (act: string, char: string, md: string, lang: string) => {
      const params = new URLSearchParams({
        activity: act,
        character: char,
        mood: md,
        language: lang,
      });
      const res = await authFetch(`/api/v1/recommendations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    },
    [authFetch]
  );

  const loadSimilarTracks = useCallback(async (track: Track) => {
    setSimilarSeedTrack(track);
    const res = await fetch(`/api/v1/recommendations/track/${encodeURIComponent(track.id)}`);
    if (res.ok) {
      const data = await res.json();
      setSimilarTracks(data.similarTracks || []);
    }
  }, []);

  const loadUserLibraryAndState = useCallback(async () => {
    if (!currentToken) return;
    const [meRes, plRes, favRes, histRes, stateRes] = await Promise.all([
      authFetch('/api/v1/users/me'),
      authFetch('/api/v1/playlists'),
      authFetch('/api/v1/library/favorites'),
      authFetch('/api/v1/history'),
      authFetch('/api/v1/player/state'),
    ]);

    if (meRes.ok) {
      const meData = await meRes.json();
      setCurrentUser(meData.user);
    }
    if (plRes.ok) {
      const plData = await plRes.json();
      setPlaylists(plData.playlists || []);
    }
    if (favRes.ok) {
      const favData = await favRes.json();
      setFavorites(favData.favorites || []);
    }
    if (histRes.ok) {
      const histData = await histRes.json();
      setHistory(histData.history || []);
    }
    if (stateRes.ok) {
      const stData = await stateRes.json();
      setActiveSession(stData.activeSession || null);
      setDevices(stData.devices || []);
    }
  }, [authFetch, currentToken]);

  const loadAdminTelemetry = useCallback(async () => {
    if (!currentToken || activeRoleMode !== 'admin') {
      setAdminStats(null);
      return;
    }
    const [statRes, usrRes, errRes, setRes] = await Promise.all([
      authFetch('/api/v1/admin/statistics'),
      authFetch('/api/v1/admin/users'),
      authFetch('/api/v1/admin/errors'),
      authFetch('/api/v1/admin/settings'),
    ]);
    if (statRes.ok) setAdminStats(await statRes.json());
    if (usrRes.ok) {
      const u = await usrRes.json();
      setAdminUsers(u.users || []);
    }
    if (errRes.ok) {
      const e = await errRes.json();
      setAdminErrors(e.logs || []);
    }
    if (setRes.ok) {
      const s = await setRes.json();
      setAdminSettings(s.settings || []);
    }
  }, [authFetch, currentToken, activeRoleMode]);

  // Initial bootstrap
  useEffect(() => {
    async function init() {
      const [demoRes, healthRes] = await Promise.all([
        fetch('/api/v1/demo-session'),
        fetch('/api/v1/health'),
      ]);
      if (healthRes.ok) {
        setHealthInfo(await healthRes.json());
      }
      if (demoRes.ok) {
        const demo = await demoRes.json();
        setAdminToken(demo.adminAccessToken);
        setListenerToken(demo.listenerAccessToken);
        setDefaultShareId(demo.defaultShareId || 'pohuNight26');
      }
    }
    init();
  }, []);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.tokens) {
        const { tokens, user, provider } = event.data;
        if (user.role === 'admin') {
          setAdminToken(tokens.accessToken);
          setActiveRoleMode('admin');
        } else {
          setListenerToken(tokens.accessToken);
          setActiveRoleMode('user');
        }
        setCurrentUser(user);
        setLibraryNotice(
          `Успешный вход через ${String(provider).toUpperCase()}: авторизован пользователь ${user.displayName || user.username} (${user.email})`
        );
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  useEffect(() => {
    loadCatalog(searchQuery, providerFilter, accessFilter);
  }, [providerFilter, accessFilter]);

  useEffect(() => {
    if (!currentToken) return;
    loadUserLibraryAndState();
    loadRecommendations(recActivity, recCharacter, recMood, recLanguage);
    loadAdminTelemetry();
  }, [
    currentToken,
    activeRoleMode,
    recActivity,
    recCharacter,
    recMood,
    recLanguage,
    loadUserLibraryAndState,
    loadRecommendations,
    loadAdminTelemetry,
  ]);

  useEffect(() => {
    if (tracks.length > 0 && !similarSeedTrack) {
      loadSimilarTracks(tracks[0]);
    }
  }, [tracks, similarSeedTrack, loadSimilarTracks]);

  const handleSelectTrack = async (track: Track) => {
    setSelectedTrack(track);
    const res = await fetch(`/api/v1/tracks/${encodeURIComponent(track.id)}`);
    if (res.ok) {
      const data = await res.json();
      setPlaybackInfo(data.playback);
    }
    // Record listen in D1 history & sync player state if track is playable/preview
    if (currentToken) {
      await authFetch('/api/v1/history', {
        method: 'POST',
        body: JSON.stringify({
          trackId: track.id,
          track,
          listenedMs: track.durationMs,
          wasSkipped: false,
        }),
      });
      if (track.accessState !== 'blocked') {
        const targetDevice = activeSession?.deviceId || 'dev_studio_mac';
        const targetName = activeSession?.deviceName || 'MacBook Pro — Studio Monitor';
        await authFetch('/api/v1/player/state', {
          method: 'PUT',
          body: JSON.stringify({
            deviceId: targetDevice,
            deviceName: targetName,
            activateDevice: true,
            currentTrack: track,
            isPlaying: true,
            positionMs: 0,
          }),
        });
      }
      await loadUserLibraryAndState();
    }
  };

  const handleToggleFavorite = async (track: Track) => {
    const isFav = favorites.some((f) => f.trackId === track.id);
    if (isFav) {
      await authFetch(`/api/v1/library/favorites/${encodeURIComponent(track.id)}`, {
        method: 'DELETE',
      });
    } else {
      await authFetch('/api/v1/library/favorites', {
        method: 'POST',
        body: JSON.stringify({ trackId: track.id, track }),
      });
    }
    await loadUserLibraryAndState();
  };

  const handleAddTrackToPlaylist = async (playlistId: string, track: Track) => {
    const res = await authFetch(`/api/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ trackId: track.id, track }),
    });
    if (res.ok) {
      setLibraryNotice(`Трек «${track.title}» добавлен в плейлист.`);
      await loadUserLibraryAndState();
    }
  };

  const handleSwitchActiveDevice = async (
    deviceId: string,
    deviceName: string,
    startPlaying: boolean
  ) => {
    setSyncConflictNotice(null);
    const res = await authFetch('/api/v1/player/state', {
      method: 'PUT',
      body: JSON.stringify({
        deviceId,
        deviceName,
        activateDevice: true,
        isPlaying: startPlaying,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveSession(data.state);
      setDevices(data.devices || []);
      if (data.deactivatedOtherDevices) {
        setSyncConflictNotice(
          `Активное устройство переключено на «${deviceName}». Воспроизведение на остальных устройствах автоматически поставлено на паузу.`
        );
      }
    }
  };

  const handleSimulateVersionConflict = async () => {
    const devId = activeSession?.deviceId || 'dev_studio_mac';
    const res = await authFetch('/api/v1/player/state', {
      method: 'PUT',
      body: JSON.stringify({
        deviceId: devId,
        positionMs: 99000,
        expectedVersion: 9999,
      }),
    });
    const data = await res.json();
    if (res.status === 409) {
      setSyncConflictNotice(`HTTP 409 ${data.error?.code}: ${data.error?.message}`);
    }
  };

  const favoriteIds = new Set(favorites.map((f) => f.trackId as string));

  const handleTabSwitch = (nextTab: ActiveTab) => {
    setActiveTab(nextTab);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Strictly 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-30 backdrop-blur">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#catalog"
          onClick={(e) => {
            e.preventDefault();
            handleTabSwitch('catalog');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          PohuMusic
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav aria-label="Основная навигация" className="flex items-center gap-6 text-sm font-medium overflow-x-auto">
          {[
            { id: 'catalog', label: 'Каталог и плеер' },
            { id: 'clients', label: 'Клиенты (APK / EXE)' },
            { id: 'recommendations', label: 'Рекомендации' },
            { id: 'library', label: 'Библиотека и D1' },
            { id: 'workbench', label: 'API и SoundCloud.ts' },
            { id: 'admin', label: 'Админ-панель' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabSwitch(item.id as ActiveTab)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === item.id
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              setActiveRoleMode((prev) => (prev === 'admin' ? 'user' : 'admin'))
            }
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {activeRoleMode === 'admin'
              ? 'Сессия: Admin (@sanchez_admin)'
              : 'Сессия: User (@nikita_wave)'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-8">
        {activeTab === 'catalog' && (
          <CatalogPlayerView
            tracks={tracks}
            searchQuery={searchQuery}
            providerFilter={providerFilter}
            accessFilter={accessFilter}
            selectedTrack={selectedTrack}
            playbackInfo={playbackInfo}
            activeSession={activeSession}
            devices={devices}
            favoriteIds={favoriteIds}
            playlists={playlists}
            syncConflictNotice={syncConflictNotice}
            onSearchChange={setSearchQuery}
            onProviderFilterChange={setProviderFilter}
            onAccessFilterChange={setAccessFilter}
            onExecuteSearch={(e) => {
              if (e) e.preventDefault();
              loadCatalog(searchQuery, providerFilter, accessFilter);
            }}
            onSelectTrack={handleSelectTrack}
            onToggleFavorite={handleToggleFavorite}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onSwitchActiveDevice={handleSwitchActiveDevice}
            onSimulateVersionConflict={handleSimulateVersionConflict}
          />
        )}

        {activeTab === 'clients' && (
          <ClientAppsShowroomView
            tracks={tracks}
            selectedTrack={selectedTrack}
            onSelectTrack={handleSelectTrack}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsView
            activity={recActivity}
            character={recCharacter}
            mood={recMood}
            language={recLanguage}
            recommendations={recommendations}
            similarSeedTrack={similarSeedTrack}
            similarTracks={similarTracks}
            feedbackStatus={feedbackStatus}
            onModeChange={(axis, val) => {
              if (axis === 'activity') setRecActivity(val);
              if (axis === 'character') setRecCharacter(val);
              if (axis === 'mood') setRecMood(val);
              if (axis === 'language') setRecLanguage(val);
            }}
            onSelectTrackToPlay={(track) => {
              handleSelectTrack(track);
              setActiveTab('catalog');
            }}
            onInspectSimilarForTrack={loadSimilarTracks}
            onSubmitFeedback={async (track, type) => {
              const res = await authFetch('/api/v1/recommendations/feedback', {
                method: 'POST',
                body: JSON.stringify({
                  trackId: track.id,
                  provider: track.provider,
                  artistId: track.artistId,
                  feedbackType: type,
                  activityMode: recActivity,
                  characterMode: recCharacter,
                  moodMode: recMood,
                  languageMode: recLanguage,
                }),
              });
              if (res.ok) {
                setFeedbackStatus(
                  `Обратная связь «${type}» для «${track.title}» сохранена в D1. Выдача пересчитана.`
                );
                await loadRecommendations(recActivity, recCharacter, recMood, recLanguage);
              }
            }}
          />
        )}

        {activeTab === 'library' && (
          <LibrarySyncView
            playlists={playlists}
            favorites={favorites}
            history={history}
            currentUser={currentUser}
            sharedPlaylistPreview={sharedPlaylistPreview}
            libraryNotice={libraryNotice}
            onCreatePlaylist={async (title, description, isPublic) => {
              const res = await authFetch('/api/v1/playlists', {
                method: 'POST',
                body: JSON.stringify({ title, description, isPublic }),
              });
              const data = await res.json();
              if (!res.ok) {
                setLibraryNotice(`Ошибка ${res.status} (${data.error?.code}): ${data.error?.message}`);
              } else {
                setLibraryNotice(`Плейлист «${title}» создан в D1.`);
                await loadUserLibraryAndState();
              }
            }}
            onDeletePlaylist={async (playlistId) => {
              const res = await authFetch(`/api/v1/playlists/${encodeURIComponent(playlistId)}`, {
                method: 'DELETE',
              });
              if (res.ok) {
                setLibraryNotice('Плейлист удалён.');
                await loadUserLibraryAndState();
              }
            }}
            onSharePlaylist={async (playlistId) => {
              const res = await authFetch(
                `/api/v1/playlists/${encodeURIComponent(playlistId)}/share`,
                { method: 'POST' }
              );
              const data = await res.json();
              if (res.ok) {
                setLibraryNotice(
                  `Создана публичная ссылка: ${data.publicApiUrl} (shareId: ${data.shareId})`
                );
                await loadUserLibraryAndState();
                const pubRes = await fetch(data.publicApiUrl);
                if (pubRes.ok) {
                  setSharedPlaylistPreview(await pubRes.json());
                }
              }
            }}
            onInspectSharedPlaylist={async (shareId) => {
              const pubRes = await fetch(`/api/v1/playlists/public/${encodeURIComponent(shareId)}`);
              if (pubRes.ok) {
                setSharedPlaylistPreview(await pubRes.json());
              }
            }}
            onRemoveFavorite={async (trackId) => {
              await authFetch(`/api/v1/library/favorites/${encodeURIComponent(trackId)}`, {
                method: 'DELETE',
              });
              await loadUserLibraryAndState();
            }}
            onClearHistory={async () => {
              await authFetch('/api/v1/history', { method: 'DELETE' });
              setLibraryNotice('История прослушиваний очищена.');
              await loadUserLibraryAndState();
            }}
            onUpdateUsername={async (newUsername) => {
              const res = await authFetch('/api/v1/users/me', {
                method: 'PATCH',
                body: JSON.stringify({ username: newUsername }),
              });
              const data = await res.json();
              if (!res.ok) {
                setLibraryNotice(`HTTP ${res.status} (${data.error?.code}): ${data.error?.message}`);
              } else {
                setLibraryNotice(
                  `Никнейм успешно изменён на @${data.user.username}. Следующая смена будет доступна через 7 дней.`
                );
                await loadUserLibraryAndState();
              }
            }}
            onAttemptSelfRoleEscalation={async () => {
              const res = await authFetch('/api/v1/users/me', {
                method: 'PATCH',
                body: JSON.stringify({ role: 'admin' }),
              });
              const data = await res.json();
              setLibraryNotice(`HTTP ${res.status} (${data.error?.code}): ${data.error?.message}`);
            }}
          />
        )}

        {activeTab === 'workbench' && (
          <ApiAuditWorkbenchView
            accessToken={currentToken}
            defaultShareId={defaultShareId}
            healthInfo={healthInfo}
          />
        )}

        {activeTab === 'admin' && (
          <AdminConsoleView
            statistics={adminStats}
            usersList={adminUsers}
            errorLogs={adminErrors}
            systemSettings={adminSettings}
            currentUserId={currentUser?.id || ''}
            adminNotice={adminNotice}
            onUpdateUserRole={async (userId, role) => {
              const res = await authFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ role }),
              });
              const data = await res.json();
              if (!res.ok) {
                setAdminNotice(`HTTP ${res.status} (${data.error?.code}): ${data.error?.message}`);
              } else {
                setAdminNotice(
                  `Роль пользователя @${data.user.username} обновлена на «${data.user.role}».`
                );
                await loadAdminTelemetry();
              }
            }}
            onUpdateSystemSetting={async (key, value) => {
              const res = await authFetch('/api/v1/admin/settings', {
                method: 'PATCH',
                body: JSON.stringify({ key, value }),
              });
              const data = await res.json();
              if (res.ok) {
                setAdminNotice(
                  `Системная настройка «${data.setting.key}» обновлена (v${data.setting.version}).`
                );
                await loadAdminTelemetry();
              }
            }}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 py-5 px-6 text-xs text-slate-400">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            PohuMusic Backend · Cloudflare Workers + TypeScript + Hono + D1 + KV + Workers Static Assets
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors"
            >
              OpenAPI 3.1.0 JSON
            </a>
            <a
              href="/api/v1/health"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors"
            >
              Health & D1 Schema
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
