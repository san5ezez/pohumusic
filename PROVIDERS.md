# POHUMUSIC — МУЗЫКАЛЬНЫЕ ПРОВАЙДЕРЫ (`PROVIDERS.md`)

Данный документ описывает архитектуру музыкальных провайдеров PohuMusic, результаты обязательного аудита пакета `soundcloud.ts`, реализацию официального SoundCloud API и YouTube Data API v3, а также единый контракт `MusicProvider`.

---

## 1. Обязательная проверка `soundcloud.ts` (Раздел 3 ТЗ)

Перед реализацией модуля `workers/src/providers/soundcloud/soundcloud.ts` проведена проверка существующего в экосистеме npm-пакета `soundcloud.ts`.

### Сводная таблица аудита

| Критерий проверки | Результат проверки |
| :--- | :--- |
| **Точное название npm-пакета** | `soundcloud.ts` |
| **Ссылка на npm** | `https://www.npmjs.com/package/soundcloud.ts` |
| **Ссылка на исходный код (GitHub)** | `https://github.com/Tenpi/soundcloud.ts` (и форк `https://github.com/Moestash/soundcloud.ts`) |
| **Документация пакета** | `https://soundcloud-ts.js.org/` |
| **Официальная документация SoundCloud API** | `https://developers.soundcloud.com/docs/api/explorer/open-api` |
| **Лицензия** | `MIT` |
| **Последняя проверенная версия** | `0.5.9` |
| **Поддержка TypeScript** | Да (написан на TypeScript, поставляет `.d.ts` декларации) |
| **Совместимость с Cloudflare Workers** | **НЕТ (Несовместим с V8 Isolates)** |
| **Поддержка Web Fetch и Web APIs** | **НЕТ** — использует `axios`, Node.js `fs`, `path`, `stream` и бинарный `ffmpeg-static` (~70 МБ) |
| **Совместимость с актуальными методами и правилами** | **НЕТ** — парсит фронтенд для извлечения чужих `client_id` из неофициального `api-v2` и скачивает потоки на диск |

### Причины непригодности стороннего npm-пакета `soundcloud.ts` для Cloudflare Workers

1. **Зависимость от Node.js-only API и нативных бинарных файлов:** Пакет `soundcloud.ts` зависит от `ffmpeg-static` и `fluent-ffmpeg`, а также модулей `fs` и `stream`. Среда исполнения Cloudflare Workers (V8 isolates) не позволяет запускать платформозависимые бинарные файлы (`ffmpeg`) и не имеет локальной файловой системы для сохранения аудиофайлов.
2. **Нарушение архитектурных и правовых ограничений ТЗ:** Сторонний пакет предназначен для скачивания треков и скрейпинга закрытых ключей, что прямо противоречит требованиям ТЗ («Не размещать музыкальные файлы на сервере», «Не обходить ограничения доступа и воспроизведения»).

### Принятое архитектурное решение

В соответствии с правилом ТЗ (*«Если непригодна, создать собственный модуль soundcloud.ts, который обращается к официальному SoundCloud API через fetch. Не использовать Node.js-only зависимости, требующие недоступных Workers API»*):

- Создан собственный, строго типизированный модуль `workers/src/providers/soundcloud/soundcloud.ts`, работающий исключительно через стандартный Web API `fetch` и `Cloudflare KV`.
- Авторизация выполняется по официальному протоколу **SoundCloud OAuth 2.1 Client Credentials** (`POST https://secure.soundcloud.com/oauth/token` с `Authorization: Basic base64(SOUNDCLOUD_CLIENT_ID:SOUNDCLOUD_CLIENT_SECRET)`), а полученный токен кэшируется в `Cloudflare KV` (`sc:oauth:access_token`).
- Все запросы к ресурсам (`https://api.soundcloud.com/tracks`, `/users`, `/playlists`, `/tracks/{id}/streams`, `/tracks/{id}/related`) передают заголовок `Authorization: OAuth <ACCESS_TOKEN>` и параметр `linked_partitioning=true`.

---

## 2. Поддержка статусов доступа SoundCloud (`playable`, `preview`, `blocked`)

Модуль `workers/src/providers/soundcloud/tracks.ts` строго проверяет поле `access` и флаг `streamable`, возвращаемые официальным API SoundCloud:

- **`playable`**: Полное воспроизведение разрешено правообладателем (`canPlayFullTrack: true`, `playbackMode: 'soundcloud_widget_or_hls'`). Возвращается официальный URL виджета SoundCloud и/или авторизованный URL потока из `/tracks/{id}/streams`.
- **`preview`**: Полный трек ограничен подпиской SoundCloud Go+ или правообладателем; доступно только 30-секундное превью (`canPlayFullTrack: false`, `canPlayPreview: true`, `playbackMode: 'soundcloud_preview_snip'`).
- **`blocked`**: Воспроизведение запрещено в регионе или заблокировано правообладателем (`canPlayFullTrack: false`, `canPlayPreview: false`, `playbackMode: 'blocked'`). Бэкенд честно возвращает причину ограничения и никогда не пытается обходить блокировку.

---

## 3. Отдельный отображаемый показатель SoundCloud (Деление на 2)

Согласно Разделу 11 ТЗ:
- Оригинальное значение прослушиваний из SoundCloud (`playback_count`) сохраняется в поле `rawPlayCount` (и в колонке `raw_provider_play_count` таблицы `listening_history`).
- Расчётный отображаемый показатель вычисляется функцией `computeSoundCloudMetrics(rawPlayCount)` как `Math.floor(rawPlayCount / 2)` и сохраняется отдельно в поле `calculatedHalvedDisplayScore` (и в колонке `calculated_sc_halved_display`).
- В каждом ответе API присутствует явный флаг `isOfficialStatistic: false` и формула `floor(raw_playback_count / 2)`, чтобы расчётный показатель никогда не выдавался за официальную статистику SoundCloud.

---

## 4. YouTube Provider (`workers/src/providers/youtube/`)

Модуль `YouTubeProvider` реализует интерфейс `MusicProvider` с соблюдением правил YouTube Terms of Service:

- **Метаданные и поиск:** Используется официальный **YouTube Data API v3** (`/search`, `/videos`, `/channels`, `/playlists`).
- **Воспроизведение:** Используется исключительно официальный **YouTube IFrame Embedded Player** (`https://www.youtube.com/embed/{videoId}?enablejsapi=1&rel=0`).
- **Запрет извлечения потоков:** Сервер никогда не скачивает аудио, не извлекает скрытые `googlevideo` потоки и не блокирует рекламу. Если у видео установлен флаг `status.embeddable === false`, возвращается `accessState: 'blocked'`.
- **Контроль квот API:** `YouTubeClient` отслеживает ежедневный расход единиц квоты в `Cloudflare KV` (`yt:quota:YYYY-MM-DD`): вызов `search.list` списывает `100` единиц, вызовы `videos.list`, `channels.list`, `playlists.list` списывают `1` единицу. При достижении `YOUTUBE_DAILY_QUOTA_LIMIT` (по умолчанию `10000`) возвращается статус `429 YOUTUBE_QUOTA_EXCEEDED`.

---

## 5. Единый интерфейс `MusicProvider`

Определён в `workers/src/providers/music-provider.ts`:

```ts
export interface MusicProvider {
  readonly providerName: ProviderSource;
  searchTracks(query: string, options?: SearchQueryOptions): Promise<Track[]>;
  searchArtists(query: string, options?: SearchQueryOptions): Promise<Artist[]>;
  searchAlbums(query: string, options?: SearchQueryOptions): Promise<Album[]>;
  getTrack(id: string): Promise<Track | null>;
  getArtist(id: string): Promise<Artist | null>;
  getAlbum(id: string): Promise<Album | null>;
  getPlaybackInfo(id: string): Promise<PlaybackInfo>;
  getRelatedTracks(id: string, limit?: number): Promise<Track[]>;
}
```
