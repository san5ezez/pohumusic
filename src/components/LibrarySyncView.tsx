import React, { useState } from 'react';
import {
  Share2,
  Trash2,
  FolderPlus,
  Clock,
  Heart,
  UserCheck,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { formatDurationMs, type Track } from '../types/api';

interface PlaylistSummary {
  id: string;
  title: string;
  description: string;
  is_public: number;
  track_count: number;
  version: number;
  share_id?: string | null;
  updated_at: string;
}

interface HistoryRecord {
  historyId: string;
  trackId: string;
  provider: 'soundcloud' | 'youtube';
  playCountForUser: number;
  rawProviderPlayCount: number;
  calculatedSoundCloudHalvedDisplay: number | null;
  playedAt: string;
  track: Track;
}

interface LibrarySyncViewProps {
  playlists: PlaylistSummary[];
  favorites: Array<{ favoriteId: string; trackId: string; track: Track }>;
  history: HistoryRecord[];
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: string;
    usernameChangedAt?: string | null;
    nextUsernameChangeAllowedAt?: string | null;
    version?: number;
  } | null;
  sharedPlaylistPreview: Record<string, any> | null;
  libraryNotice: string | null;
  onCreatePlaylist: (title: string, description: string, isPublic: boolean) => Promise<void>;
  onDeletePlaylist: (playlistId: string) => Promise<void>;
  onSharePlaylist: (playlistId: string) => Promise<void>;
  onInspectSharedPlaylist: (shareId: string) => Promise<void>;
  onRemoveFavorite: (trackId: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onUpdateUsername: (newUsername: string) => Promise<void>;
  onAttemptSelfRoleEscalation: () => Promise<void>;
}

export const LibrarySyncView: React.FC<LibrarySyncViewProps> = ({
  playlists,
  favorites,
  history,
  currentUser,
  sharedPlaylistPreview,
  libraryNotice,
  onCreatePlaylist,
  onDeletePlaylist,
  onSharePlaylist,
  onInspectSharedPlaylist,
  onRemoveFavorite,
  onClearHistory,
  onUpdateUsername,
  onAttemptSelfRoleEscalation,
}) => {
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(true);
  const [newUsernameInput, setNewUsernameInput] = useState(currentUser?.username || '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) {
      setFormError('Введите название плейлиста.');
      return;
    }
    setFormError(null);
    await onCreatePlaylist(newPlaylistTitle.trim(), newPlaylistDesc.trim(), newPlaylistPublic);
    setNewPlaylistTitle('');
    setNewPlaylistDesc('');
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsernameInput.trim() || newUsernameInput.trim().length < 3) {
      setFormError('Никнейм должен содержать минимум 3 символа.');
      return;
    }
    setFormError(null);
    await onUpdateUsername(newUsernameInput.trim());
  };

  return (
    <div className="space-y-8">
      {libraryNotice && (
        <div
          role="status"
          className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 text-xs font-mono text-amber-300"
        >
          {libraryNotice}
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-mono text-rose-200"
        >
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 columns: Playlists (Max 10) & Public Share Inspector */}
        <div className="lg:col-span-7 space-y-6">
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Плейлисты пользователя в D1 (`/api/v1/playlists`)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Правило D1: максимум 10 плейлистов на пользователя (SQL-триггер `trg_playlists_max_10_per_user`)
                </p>
              </div>
              <div className="text-sm font-mono tabular-nums text-amber-400 shrink-0">
                {playlists.length} / 10
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label htmlFor="playlist-title-input" className="sr-only">
                  Название нового плейлиста
                </label>
                <input
                  id="playlist-title-input"
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="Название плейлиста..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="playlist-desc-input" className="sr-only">
                  Описание плейлиста
                </label>
                <input
                  id="playlist-desc-input"
                  type="text"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="Описание (необязательно)..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-3 flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={newPlaylistPublic}
                    onChange={(e) => setNewPlaylistPublic(e.target.checked)}
                    className="rounded border-slate-700"
                  />
                  <span>Публ.</span>
                </label>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Создать</span>
                </button>
              </div>
            </form>

            <div className="mt-6 divide-y divide-slate-800/80">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {pl.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Треков: <span className="font-mono tabular-nums text-slate-200">{pl.track_count}</span> ·{' '}
                      {pl.is_public ? 'Публичный' : 'Приватный'} · v{pl.version}
                      {pl.share_id ? ` · shareId: ${pl.share_id}` : ''}
                    </div>
                    {pl.description && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{pl.description}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSharePlaylist(pl.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-amber-500/50 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Поделиться</span>
                    </button>

                    {pl.share_id && (
                      <button
                        type="button"
                        onClick={() => onInspectSharedPlaylist(pl.share_id!)}
                        className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-amber-300 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <span>Открыть `/public/{pl.share_id}`</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeletePlaylist(pl.id)}
                      aria-label={`Удалить плейлист ${pl.title}`}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-950 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {sharedPlaylistPreview && (
              <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400">
                    Публичный плейлист `/api/v1/playlists/public/{sharedPlaylistPreview.shareId}`
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    Открытий по ссылке: {sharedPlaylistPreview.accessCount}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {sharedPlaylistPreview.playlist?.title} — автор @{sharedPlaylistPreview.playlist?.ownerUsername}
                </div>
                <div className="text-xs text-slate-400">
                  Треков внутри: {sharedPlaylistPreview.playlist?.tracks?.length || 0}
                </div>
              </div>
            )}
          </section>

          {/* Listening History: Last 15 Unique Tracks */}
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    История прослушиваний (`/api/v1/history`)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Хранятся последние 15 уникальных треков пользователя ({history.length} / 15) · Исходные и расчётные (raw/2) показатели разделены
                  </p>
                </div>
              </div>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-rose-500/40 text-xs font-medium text-slate-300 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0"
                >
                  Очистить историю
                </button>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-800/80">
              {history.length === 0 ? (
                <p className="py-6 text-xs text-slate-400 text-center">
                  История прослушиваний пуста. Нажмите на любой трек в каталоге для записи в историю.
                </p>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.historyId}
                    className="py-3 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100 truncate">
                        <span className="font-mono tabular-nums text-slate-500 mr-2">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        {item.track.title}
                      </div>
                      <div className="text-slate-400 mt-0.5 font-mono tabular-nums">
                        {item.track.artistName} · {item.provider.toUpperCase()} · Прослушано раз:{' '}
                        {item.playCountForUser} · Raw: {item.rawProviderPlayCount.toLocaleString('ru-RU')}
                        {item.calculatedSoundCloudHalvedDisplay !== null
                          ? ` · Расчётный (raw/2): ${item.calculatedSoundCloudHalvedDisplay.toLocaleString('ru-RU')}`
                          : ''}
                      </div>
                    </div>
                    <div className="text-slate-400 font-mono tabular-nums shrink-0">
                      {formatDurationMs(item.track.durationMs)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right 5 columns: Profile Rules (7-day Nickname Cooldown & Self-Role Guard) + Favorites */}
        <div className="lg:col-span-5 space-y-6">
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-base font-semibold text-slate-100">
                Профиль и правила безопасности (`/api/v1/users/me`)
              </h2>
            </div>

            {currentUser && (
              <div className="mt-4 space-y-4">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Текущий никнейм:</span>
                    <span className="text-slate-100">@{currentUser.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-slate-200">{currentUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Роль RBAC:</span>
                    <span className="text-amber-400 font-semibold">{currentUser.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Последняя смена ника:</span>
                    <span className="text-slate-300">
                      {currentUser.usernameChangedAt
                        ? new Date(currentUser.usernameChangedAt).toLocaleString('ru-RU')
                        : 'Ещё не менялся'}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleUsernameSubmit} className="space-y-2">
                  <label htmlFor="username-cooldown-input" className="block text-xs font-medium text-slate-300">
                    Смена никнейма (разрешено не чаще 1 раза в 7 дней):
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="username-cooldown-input"
                      type="text"
                      value={newUsernameInput}
                      onChange={(e) => setNewUsernameInput(e.target.value)}
                      placeholder="Новый никнейм..."
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Сменить ник
                    </button>
                  </div>
                </form>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Проверка запрета самостоятельной смены своей роли (`PATCH /users/me`):
                  </div>
                  <button
                    type="button"
                    onClick={onAttemptSelfRoleEscalation}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Тест 403 Self-Role</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Favorites */}
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-amber-400 shrink-0" />
                <h2 className="text-base font-semibold text-slate-100">
                  Избранное (`/api/v1/library/favorites`)
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-300">
                {favorites.length}
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-800/80">
              {favorites.length === 0 ? (
                <p className="py-6 text-xs text-slate-400 text-center">
                  Список избранного пуст.
                </p>
              ) : (
                favorites.map((fav) => (
                  <div key={fav.favoriteId} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {fav.track.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {fav.track.artistName} · {fav.track.provider.toUpperCase()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFavorite(fav.trackId)}
                      aria-label={`Удалить ${fav.track.title} из избранного`}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
