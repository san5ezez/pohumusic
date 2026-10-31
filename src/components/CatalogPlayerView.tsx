import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  Plus,
  Search,
  Laptop,
  Smartphone,
  ShieldAlert,
  ExternalLink,
  Volume2,
  Disc3,
} from 'lucide-react';
import {
  formatDurationMs,
  type PlaybackInfo,
  type PlayerDeviceSession,
  type ProviderSource,
  type Track,
} from '../types/api';

interface CatalogPlayerViewProps {
  tracks: Track[];
  searchQuery: string;
  providerFilter: 'all' | ProviderSource;
  accessFilter: string;
  selectedTrack: Track | null;
  playbackInfo: PlaybackInfo | null;
  activeSession: PlayerDeviceSession | null;
  devices: PlayerDeviceSession[];
  favoriteIds: Set<string>;
  playlists: Array<{ id: string; title: string; track_count: number }>;
  syncConflictNotice: string | null;
  onSearchChange: (q: string) => void;
  onProviderFilterChange: (p: 'all' | ProviderSource) => void;
  onAccessFilterChange: (a: string) => void;
  onExecuteSearch: (e?: React.FormEvent) => void;
  onSelectTrack: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
  onAddTrackToPlaylist: (playlistId: string, track: Track) => void;
  onSwitchActiveDevice: (deviceId: string, deviceName: string, startPlaying: boolean) => void;
  onSimulateVersionConflict: () => void;
}

export const CatalogPlayerView: React.FC<CatalogPlayerViewProps> = ({
  tracks,
  searchQuery,
  providerFilter,
  accessFilter,
  selectedTrack,
  playbackInfo,
  activeSession,
  devices,
  favoriteIds,
  playlists,
  syncConflictNotice,
  onSearchChange,
  onProviderFilterChange,
  onAccessFilterChange,
  onExecuteSearch,
  onSelectTrack,
  onToggleFavorite,
  onAddTrackToPlaylist,
  onSwitchActiveDevice,
  onSimulateVersionConflict,
}) => {
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>(playlists[0]?.id || '');

  const effectivePlaylistId = targetPlaylistId || playlists[0]?.id || '';

  return (
    <div className="space-y-8">
      {/* Search & Filter Toolbar */}
      <section className="border border-slate-800 bg-slate-900/70 p-6 rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Единый каталог MusicProvider и синхронизация плеера
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Поиск через официальный SoundCloud API и YouTube Data API v3 · Строгий контроль статусов playable, preview и blocked · Без хранения аудио на сервере
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Фильтр провайдера"
              className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
            >
              {(['all', 'soundcloud', 'youtube'] as const).map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => onProviderFilterChange(prov)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    providerFilter === prov
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {prov === 'all' ? 'Все источники' : prov === 'soundcloud' ? 'SoundCloud' : 'YouTube'}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Фильтр доступности"
              className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
            >
              {[
                { id: 'all', label: 'Все статусы' },
                { id: 'playable', label: 'Playable' },
                { id: 'preview', label: 'Preview 30s' },
                { id: 'blocked', label: 'Blocked' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onAccessFilterChange(st.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    accessFilter === st.id
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={onExecuteSearch} className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="catalog-search-input" className="sr-only">
              Поиск треков, исполнителей или жанров
            </label>
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="catalog-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск треков по названию, артисту, жанру или тегам (например: Северный Ветер, Monolith, Aurora)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Найти в каталоге
          </button>
        </form>
      </section>

      {/* Main 2-Column Split: Catalog Table + Active Track & Multi-Device Sync Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 columns: Track list */}
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Результаты выдачи `/api/v1/tracks/search`
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Найдено треков: <span className="font-mono tabular-nums text-slate-200">{tracks.length}</span> · Выберите трек для проверки `PlaybackInfo` и метрик
              </p>
            </div>

            {playlists.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="quick-playlist-select" className="text-xs text-slate-400 whitespace-nowrap">
                  Целевой плейлист:
                </label>
                <select
                  id="quick-playlist-select"
                  value={effectivePlaylistId}
                  onChange={(e) => setTargetPlaylistId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.title} ({pl.track_count})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-800/80">
            {tracks.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-slate-400">
                  По вашему запросу треки не найдены. Попробуйте сбросить фильтр или изменить запрос.
                </p>
              </div>
            ) : (
              tracks.map((track) => {
                const isSelected = selectedTrack?.id === track.id;
                const isFav = favoriteIds.has(track.id);
                return (
                  <div
                    key={track.id}
                    className={`px-6 py-4 transition-colors flex items-center justify-between gap-4 ${
                      isSelected ? 'bg-slate-800/70' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectTrack(track)}
                        aria-label={`Проверить и воспроизвести ${track.title}`}
                        className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0 group border border-slate-700/60"
                      >
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
                            <Disc3 className="w-5 h-5" />
                          </div>
                        )}
                        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onSelectTrack(track)}
                          className="text-left block w-full truncate text-sm font-semibold text-slate-100 hover:text-amber-400 transition-colors"
                        >
                          {track.title}
                        </button>

                        {/* Zero-Pill Metadata Discipline: Clean unboxed inline text with middle dot separators */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-1">
                          <span className="text-slate-300 font-medium">{track.artistName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="uppercase font-mono text-[11px] text-slate-300">
                            {track.provider}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-mono ${
                              track.accessState === 'playable'
                                ? 'text-emerald-400'
                                : track.accessState === 'preview'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            access:{track.accessState}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatDurationMs(track.durationMs)}
                          </span>
                        </div>

                        {/* SoundCloud Raw vs Calculated (/2) Display Metric */}
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                          <span>
                            Исходных прослушиваний: {track.rawPlayCount.toLocaleString('ru-RU')}
                          </span>
                          {track.provider === 'soundcloud' && track.soundcloudMetrics && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-300/90">
                                Расчётный показатель (raw/2, неофиц.):{' '}
                                {track.soundcloudMetrics.calculatedHalvedDisplayScore.toLocaleString('ru-RU')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(track)}
                        aria-label={
                          isFav
                            ? `Удалить «${track.title}» из избранного`
                            : `Добавить «${track.title}» в избранное`
                        }
                        className={`p-2 rounded-lg border transition-colors ${
                          isFav
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                      </button>

                      {effectivePlaylistId && (
                        <button
                          type="button"
                          onClick={() => onAddTrackToPlaylist(effectivePlaylistId, track)}
                          aria-label={`Добавить «${track.title}» в плейлист`}
                          className="px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-950 text-xs font-medium text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>В плейлист</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 5 columns: Selected Track Playback Inspector & Multi-Device Sync */}
        <div className="lg:col-span-5 space-y-6">
          {/* Playback Resolution Inspector */}
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100">
              Разрешённый режим воспроизведения (`/tracks/:id`)
            </h2>
            {selectedTrack && playbackInfo ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-4">
                  {selectedTrack.artworkUrl ? (
                    <img
                      src={selectedTrack.artworkUrl}
                      alt={selectedTrack.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <Volume2 className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-100 truncate">
                      {selectedTrack.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedTrack.artistName} · {selectedTrack.genre || 'Electronic'} · Язык:{' '}
                      {selectedTrack.language}
                    </p>
                    <p className="text-xs font-mono text-slate-300 mt-1">
                      ID: {selectedTrack.id} · Режим: {playbackInfo.playbackMode}
                    </p>
                  </div>
                </div>

                {/* Access State Policy Notice */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-400">Статус доступа API:</span>
                    <span
                      className={
                        playbackInfo.accessState === 'playable'
                          ? 'text-emerald-400 font-semibold'
                          : playbackInfo.accessState === 'preview'
                          ? 'text-amber-400 font-semibold'
                          : 'text-rose-400 font-semibold'
                      }
                    >
                      {playbackInfo.accessState.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-400">Полный поток разрешён:</span>
                    <span className="text-slate-200">
                      {playbackInfo.canPlayFullTrack ? 'Да (Official API / Embed)' : 'Нет'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-400">30-сек превью разрешено:</span>
                    <span className="text-slate-200">
                      {playbackInfo.canPlayPreview ? 'Да' : 'Нет'}
                    </span>
                  </div>
                  {playbackInfo.reasonIfRestricted && (
                    <div className="pt-2 border-t border-slate-800/80 text-amber-300 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{playbackInfo.reasonIfRestricted}</span>
                    </div>
                  )}
                </div>

                {/* SoundCloud Separate Halved Display Metric Breakdown */}
                {selectedTrack.provider === 'soundcloud' && selectedTrack.soundcloudMetrics && (
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="font-semibold text-slate-200">
                      Раздельное хранение показателей SoundCloud (Раздел 11 ТЗ)
                    </div>
                    <div className="flex items-center justify-between font-mono tabular-nums text-slate-300">
                      <span>Оригинальное значение (rawPlayCount):</span>
                      <span>{selectedTrack.soundcloudMetrics.rawPlayCount.toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono tabular-nums text-amber-300">
                      <span>Расчётный показатель (raw / 2):</span>
                      <span>
                        {selectedTrack.soundcloudMetrics.calculatedHalvedDisplayScore.toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">
                      Примечание: расчётный показатель вычисляется по формуле{' '}
                      <code className="text-slate-300">
                        {selectedTrack.soundcloudMetrics.calculationFormula}
                      </code>{' '}
                      и не является официальной статистикой SoundCloud.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <a
                    href={playbackInfo.permalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Открыть на {selectedTrack.provider === 'soundcloud' ? 'SoundCloud' : 'YouTube'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {playbackInfo.officialEmbedUrl && (
                    <span className="text-[11px] font-mono text-slate-400 truncate max-w-[240px]">
                      Embed: {playbackInfo.officialEmbedUrl}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Выберите любой трек в списке слева для инспекции разрешённого воспроизведения.
              </p>
            )}
          </section>

          {/* Multi-Device Synchronization & Single Active Speaker Control */}
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Синхронизация устройств в D1 (`/api/v1/player/state`)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  При переключении активного устройства звук на остальных устройствах автоматически ставится на паузу
                </p>
              </div>
              {activeSession && (
                <span className="text-xs font-mono tabular-nums text-slate-300 shrink-0">
                  v{activeSession.version}
                </span>
              )}
            </div>

            {syncConflictNotice && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 font-mono"
              >
                {syncConflictNotice}
              </div>
            )}

            <div className="mt-4 space-y-3">
              {devices.map((dev) => {
                const isMobile = dev.deviceId.includes('iphone') || dev.deviceId.includes('mobile');
                return (
                  <div
                    key={dev.deviceId}
                    className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                      dev.isActiveDevice
                        ? 'bg-slate-950 border-amber-500/60'
                        : 'bg-slate-950/50 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isMobile ? (
                        <Smartphone className="w-4 h-4 text-slate-300 shrink-0" />
                      ) : (
                        <Laptop className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {dev.deviceName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {dev.isActiveDevice ? 'Активный источник звука' : 'Ожидание (Неактивно)'} ·{' '}
                          {dev.isPlaying ? 'Воспроизведение' : 'Пауза'} · v{dev.version}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onSwitchActiveDevice(
                          dev.deviceId,
                          dev.deviceName,
                          dev.isActiveDevice ? !dev.isPlaying : true
                        )
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        dev.isActiveDevice
                          ? 'bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {dev.isActiveDevice && dev.isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Пауза</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>{dev.isActiveDevice ? 'Играть' : 'Переключить звук сюда'}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Проверка оптимистичной блокировки D1 (`expectedVersion`):
              </span>
              <button
                type="button"
                onClick={onSimulateVersionConflict}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Проверить 409 Conflict
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
