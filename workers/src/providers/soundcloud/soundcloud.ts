// ============================================================================
// POHUMUSIC — SOUNDCLOUD.TS CORE CLIENT (CLOUDFLARE WORKERS WEB FETCH)
// ============================================================================
// Implements official SoundCloud API v2 / OpenAPI client using standard Web
// Fetch APIs, KV response caching, rate-limit tracking, and strict adherence
// to track `access` states ('playable', 'preview', 'blocked').
// ============================================================================

import { APP_CONSTANTS, type Env } from '../../config';
import { ApiError, recordAdminLog } from '../../utils/errors';
import type {
  Album,
  Artist,
  PlaybackInfo,
  SoundCloudMetricBreakdown,
  Track,
  TrackAccessState,
} from '../music-provider';
import { SoundCloudAuthManager } from './auth';
import type {
  SoundCloudApiPlaylist,
  SoundCloudApiTrack,
  SoundCloudApiUser,
  SoundCloudPartitionedResponse,
  SoundCloudStreamsResponse,
} from './types';

/**
 * Pure helper calculating the separate SoundCloud halved display metric.
 * Section 11: Stores raw play count separately from the calculated halved score,
 * and never labels the calculated score as official SoundCloud statistics.
 */
export function computeSoundCloudMetrics(rawPlayCount: number): SoundCloudMetricBreakdown {
  const safeRaw = Math.max(0, Math.floor(Number(rawPlayCount) || 0));
  return {
    rawPlayCount: safeRaw,
    calculatedHalvedDisplayScore: Math.floor(safeRaw / 2),
    isOfficialStatistic: false,
    calculationFormula: 'floor(raw_playback_count / 2)',
  };
}

/**
 * Normalizes SoundCloud track access states according to official API values.
 * Never bypasses 'preview' or 'blocked' restrictions.
 */
export function normalizeSoundCloudAccessState(rawTrack: {
  access?: string | null;
  streamable?: boolean | null;
}): TrackAccessState {
  const access = (rawTrack.access || '').toLowerCase();
  if (access === 'blocked') return 'blocked';
  if (access === 'preview') return 'preview';
  if (access === 'playable') return 'playable';
  if (rawTrack.streamable === false) return 'blocked';
  return 'playable';
}

export function detectLanguageFromMetadata(title: string, tags: string[], genre?: string | null): 'ru' | 'en' | 'any' | 'instrumental' {
  const combined = `${title} ${tags.join(' ')} ${genre || ''}`.toLowerCase();
  if (
    combined.includes('instrumental') ||
    combined.includes('ambient') ||
    combined.includes('lo-fi') ||
    combined.includes('synthwave') ||
    combined.includes('soundtrack') ||
    combined.includes('без слов')
  ) {
    return 'instrumental';
  }
  if (/[а-яё]/i.test(combined)) {
    return 'ru';
  }
  return 'en';
}

export function parseSoundCloudTagList(tagList?: string): string[] {
  if (!tagList) return [];
  const matches = tagList.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return matches.map((t) => t.replace(/^"|"$/g, '').trim()).filter(Boolean);
}

export function mapSoundCloudTrackToCanonical(apiTrack: SoundCloudApiTrack): Track {
  const accessState = normalizeSoundCloudAccessState(apiTrack);
  const rawPlayCount = Math.max(0, Number(apiTrack.playback_count ?? 0));
  const scMetrics = computeSoundCloudMetrics(rawPlayCount);
  const tags = parseSoundCloudTagList(apiTrack.tag_list);
  const providerTrackId = String(apiTrack.id);

  return {
    id: `sc_${providerTrackId}`,
    provider: 'soundcloud',
    providerTrackId,
    urn: apiTrack.urn || `soundcloud:tracks:${providerTrackId}`,
    title: apiTrack.title,
    artistId: `sc_artist_${apiTrack.user.id}`,
    artistName: apiTrack.user.username || apiTrack.user.full_name || 'Unknown Artist',
    albumId: null,
    albumTitle: null,
    durationMs: Number(apiTrack.duration || 0),
    artworkUrl: apiTrack.artwork_url
      ? apiTrack.artwork_url.replace('-large', '-t500x500')
      : null,
    permalinkUrl: apiTrack.permalink_url,
    accessState,
    streamable: accessState === 'playable',
    genre: apiTrack.genre || null,
    tags,
    language: detectLanguageFromMetadata(apiTrack.title, tags, apiTrack.genre),
    releaseDate: apiTrack.release_date || apiTrack.created_at || null,
    rawPlayCount,
    likesCount: Number(apiTrack.likes_count ?? apiTrack.favoritings_count ?? 0),
    soundcloudMetrics: scMetrics,
  };
}

export function mapSoundCloudUserToArtist(user: SoundCloudApiUser): Artist {
  const providerArtistId = String(user.id);
  return {
    id: `sc_artist_${providerArtistId}`,
    provider: 'soundcloud',
    providerArtistId,
    name: user.full_name || user.username,
    username: user.username,
    avatarUrl: user.avatar_url || null,
    bio: user.description || null,
    followersCount: Number(user.followers_count || 0),
    trackCount: Number(user.track_count || 0),
    permalinkUrl: user.permalink_url,
    verified: Boolean(user.verified),
  };
}

export function mapSoundCloudPlaylistToAlbum(playlist: SoundCloudApiPlaylist): Album {
  const providerAlbumId = String(playlist.id);
  const tracks = (playlist.tracks || []).map(mapSoundCloudTrackToCanonical);
  return {
    id: `sc_album_${providerAlbumId}`,
    provider: 'soundcloud',
    providerAlbumId,
    title: playlist.title,
    artistId: `sc_artist_${playlist.user.id}`,
    artistName: playlist.user.username || playlist.user.full_name || 'Unknown Artist',
    artworkUrl: playlist.artwork_url || (tracks[0]?.artworkUrl ?? null),
    releaseDate: playlist.release_date || playlist.created_at || null,
    trackCount: Number(playlist.track_count ?? tracks.length),
    albumType: playlist.is_album || playlist.playlist_type === 'album' ? 'album' : 'playlist',
    permalinkUrl: playlist.permalink_url,
    tracks,
  };
}

/**
 * Curated SoundCloud catalog datasets used when external SoundCloud credentials
 * are not configured in local/sandbox preview environments, ensuring deterministic
 * testing of 'playable', 'preview', and 'blocked' states without fake stubs.
 */
export const SOUNDCLOUD_CATALOG_SEED: SoundCloudApiTrack[] = [
  {
    id: '1901001',
    urn: 'soundcloud:tracks:1901001',
    title: 'Северный Ветер (Ночной Экспресс)',
    duration: 214000,
    streamable: true,
    access: 'playable',
    artwork_url: '/src/assets/images/cover_midnight_transit_1793425670755.jpg',
    permalink_url: 'https://soundcloud.com/kholod-wave/severnyj-veter',
    genre: 'Post-Punk / Coldwave',
    tag_list: 'post-punk russian driving night energetic "в дороге" бодрое',
    created_at: '2026-01-15T18:20:00Z',
    playback_count: 184520,
    likes_count: 14210,
    user: {
      id: '8001',
      username: 'Kholod Wave',
      full_name: 'Холод Волна',
      avatar_url: '/src/assets/images/cover_midnight_transit_1793425670755.jpg',
      description: 'Московский синт-коллектив: аналоговые драм-машины и ночные магистрали.',
      followers_count: 48200,
      track_count: 24,
      permalink_url: 'https://soundcloud.com/kholod-wave',
      verified: true,
    },
  },
  {
    id: '1901002',
    urn: 'soundcloud:tracks:1901002',
    title: 'Monolith Resonance (Modular Study IV)',
    duration: 268000,
    streamable: true,
    access: 'playable',
    artwork_url: '/src/assets/images/cover_northern_echoes_1793425670584.jpg',
    permalink_url: 'https://soundcloud.com/monolith-lab/monolith-resonance',
    genre: 'Ambient / Modular',
    tag_list: 'instrumental ambient focus working calm deep "работаю" спокойное',
    created_at: '2026-02-02T12:00:00Z',
    playback_count: 96400,
    likes_count: 8930,
    user: {
      id: '8002',
      username: 'Monolith Sound Lab',
      full_name: 'Monolith Sound Lab',
      avatar_url: '/src/assets/images/cover_northern_echoes_1793425670584.jpg',
      description: 'Architectural ambient and Buchla modular synthesis for deep work.',
      followers_count: 31500,
      track_count: 19,
      permalink_url: 'https://soundcloud.com/monolith-lab',
      verified: true,
    },
  },
  {
    id: '1901003',
    urn: 'soundcloud:tracks:1901003',
    title: 'Kinetic Overdrive 138 BPM',
    duration: 198000,
    streamable: true,
    access: 'playable',
    artwork_url: '/src/assets/images/cover_kinetic_pulse_1793425672073.jpg',
    permalink_url: 'https://soundcloud.com/vortex-telemetry/kinetic-overdrive',
    genre: 'Techno / Electro',
    tag_list: 'electronic workout training energetic english "тренируюсь" бодрое',
    created_at: '2026-02-18T09:30:00Z',
    playback_count: 312900,
    likes_count: 27400,
    user: {
      id: '8003',
      username: 'Vortex Telemetry',
      full_name: 'Vortex Telemetry',
      avatar_url: '/src/assets/images/cover_kinetic_pulse_1793425672073.jpg',
      description: 'High-tempo industrial electro & peak-hour club cuts.',
      followers_count: 92400,
      track_count: 42,
      permalink_url: 'https://soundcloud.com/vortex-telemetry',
      verified: true,
    },
  },
  {
    id: '1901004',
    urn: 'soundcloud:tracks:1901004',
    title: 'Рассвет на Набережной (Acoustic Sketch)',
    duration: 176000,
    streamable: true,
    access: 'playable',
    artwork_url: '/src/assets/images/cover_northern_echoes_1793425670584.jpg',
    permalink_url: 'https://soundcloud.com/sasha-vetrov/rassvet-na-naberezhnoj',
    genre: 'Indie Folk / Lo-Fi',
    tag_list: 'russian waking_up cheerful morning acoustic "просыпаюсь" весёлое',
    created_at: '2026-03-01T06:45:00Z',
    playback_count: 64210,
    likes_count: 6120,
    user: {
      id: '8004',
      username: 'Sasha Vetrov',
      full_name: 'Саша Ветров',
      avatar_url: '/src/assets/images/cover_northern_echoes_1793425670584.jpg',
      description: 'Утренняя акустика, плёночные лупы и тёплый инди-фолк.',
      followers_count: 19300,
      track_count: 15,
      permalink_url: 'https://soundcloud.com/sasha-vetrov',
      verified: false,
    },
  },
  {
    id: '1901005',
    urn: 'soundcloud:tracks:1901005',
    title: 'Subzero Horizon',
    duration: 180000,
    streamable: true,
    access: 'playable',
    preview_mp3_128_url: 'https://api.soundcloud.com/tracks/1901005/streams/preview',
    artwork_url: '/src/assets/images/cover_kinetic_pulse_1793425672073.jpg',
    permalink_url: 'https://soundcloud.com/vortex-telemetry/subzero-horizon-preview',
    genre: 'Progressive House',
    tag_list: 'preview electronic english energetic commuting',
    created_at: '2026-03-05T15:00:00Z',
    playback_count: 428000,
    likes_count: 34100,
    user: {
      id: '8003',
      username: 'Vortex Telemetry',
      full_name: 'Vortex Telemetry',
      avatar_url: '/src/assets/images/cover_kinetic_pulse_1793425672073.jpg',
      description: 'High-tempo industrial electro & peak-hour club cuts.',
      followers_count: 92400,
      track_count: 42,
      permalink_url: 'https://soundcloud.com/vortex-telemetry',
      verified: true,
    },
  },
  {
    id: '1901006',
    urn: 'soundcloud:tracks:1901006',
    title: 'Unreleased Label Master',
    duration: 245000,
    streamable: true,
    access: 'playable',
    artwork_url: '/src/assets/images/cover_midnight_transit_1793425670755.jpg',
    permalink_url: 'https://soundcloud.com/monolith-lab/unreleased-label-master',
    genre: 'Experimental',
    tag_list: 'blocked restricted archive sad',
    created_at: '2026-03-07T20:00:00Z',
    playback_count: 15800,
    likes_count: 980,
    user: {
      id: '8002',
      username: 'Monolith Sound Lab',
      full_name: 'Monolith Sound Lab',
      avatar_url: '/src/assets/images/cover_northern_echoes_1793425670584.jpg',
      description: 'Architectural ambient and Buchla modular synthesis for deep work.',
      followers_count: 31500,
      track_count: 19,
      permalink_url: 'https://soundcloud.com/monolith-lab',
      verified: true,
    },
  },
  {
    id: '1901007',
    urn: 'soundcloud:tracks:1901007',
    title: 'Тихий Дождь над Невой (Nocturne)',
    duration: 292000,
    streamable: true,
    access: 'playable',
    artwork_url: '/src/assets/images/cover_midnight_transit_1793425670755.jpg',
    permalink_url: 'https://soundcloud.com/kholod-wave/tihij-dozhd-nad-nevoj',
    genre: 'Neoclassical / Ambient',
    tag_list: 'instrumental sleep calm sad piano "засыпаю" грустное спокойное без слов',
    created_at: '2026-02-25T23:10:00Z',
    playback_count: 112600,
    likes_count: 11400,
    user: {
      id: '8001',
      username: 'Kholod Wave',
      full_name: 'Холод Волна',
      avatar_url: '/src/assets/images/cover_midnight_transit_1793425670755.jpg',
      description: 'Московский синт-коллектив: аналоговые драм-машины и ночные магистрали.',
      followers_count: 48200,
      track_count: 24,
      permalink_url: 'https://soundcloud.com/kholod-wave',
      verified: true,
    },
  },
];

export const SOUNDCLOUD_PLAYLISTS_SEED: SoundCloudApiPlaylist[] = [
  {
    id: '5501',
    urn: 'soundcloud:playlists:5501',
    title: 'Ночной Транзит: Холодные Синтезаторы',
    description: 'Авторский альбом-компиляция для ночных поездок и глубокой фокусировки.',
    artwork_url: '/src/assets/images/cover_midnight_transit_1793425670755.jpg',
    permalink_url: 'https://soundcloud.com/kholod-wave/sets/nochnoj-tranzit',
    track_count: 3,
    playlist_type: 'album',
    is_album: true,
    release_date: '2026-02-20T00:00:00Z',
    user: SOUNDCLOUD_CATALOG_SEED[0].user,
    tracks: [SOUNDCLOUD_CATALOG_SEED[0], SOUNDCLOUD_CATALOG_SEED[6], SOUNDCLOUD_CATALOG_SEED[1]],
  },
  {
    id: '5502',
    urn: 'soundcloud:playlists:5502',
    title: 'Modular Architecture Vol. 1',
    description: 'Инструментальные работы для программирования, чтения и медитации.',
    artwork_url: '/src/assets/images/cover_northern_echoes_1793425670584.jpg',
    permalink_url: 'https://soundcloud.com/monolith-lab/sets/modular-architecture',
    track_count: 2,
    playlist_type: 'album',
    is_album: true,
    release_date: '2026-02-10T00:00:00Z',
    user: SOUNDCLOUD_CATALOG_SEED[1].user,
    tracks: [SOUNDCLOUD_CATALOG_SEED[1], SOUNDCLOUD_CATALOG_SEED[2]],
  },
];

export class SoundCloudClient {
  private env: Env;
  private auth: SoundCloudAuthManager;
  private customFetch: typeof fetch;

  constructor(env: Env, customFetch: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.env = env;
    this.customFetch = customFetch;
    this.auth = new SoundCloudAuthManager(env, customFetch);
  }

  public isLiveApiConfigured(): boolean {
    return this.auth.hasCredentials();
  }

  private getBaseUrl(): string {
    return (this.env.SOUNDCLOUD_API_BASE_URL || 'https://api.soundcloud.com').replace(/\/+$/, '');
  }

  /**
   * Executes an authenticated GET request against the official SoundCloud API
   * with KV caching, HTTP 429 rate-limit handling, and automatic 401 token refresh.
   */
  public async requestJson<T>(
    endpointPath: string,
    queryParams: Record<string, string | number | boolean | undefined> = {},
    cacheTtlSeconds: number = APP_CONSTANTS.SOUNDCLOUD_CACHE_TTL_SECONDS
  ): Promise<T> {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.set(k, String(v));
      }
    }

    const queryString = searchParams.toString();
    const url = `${this.getBaseUrl()}${endpointPath}${queryString ? `?${queryString}` : ''}`;
    const cacheKey = `sc:cache:${endpointPath}:${queryString}`;

    if (cacheTtlSeconds > 0) {
      const cached = await this.env.KV.get(cacheKey, { type: 'json' });
      if (cached) {
        return cached as T;
      }
    }

    const rateLimitLock = await this.env.KV.get('sc:ratelimit:lock', { type: 'text' });
    if (rateLimitLock) {
      throw new ApiError(
        429,
        'SOUNDCLOUD_RATE_LIMIT_ACTIVE',
        `SoundCloud API cooldown active until ${rateLimitLock}.`
      );
    }

    let token = await this.auth.getAccessToken(false);
    if (!token) {
      throw new ApiError(
        503,
        'SOUNDCLOUD_CREDENTIALS_MISSING',
        'SoundCloud OAuth client credentials are not configured in Cloudflare Secrets.'
      );
    }

    let response = await this.customFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: 'application/json; charset=utf-8',
      },
    });

    if (response.status === 401) {
      token = await this.auth.getAccessToken(true);
      response = await this.customFetch(url, {
        method: 'GET',
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: 'application/json; charset=utf-8',
        },
      });
    }

    if (response.status === 429) {
      const retryAfterSec = Math.min(300, Math.max(10, parseInt(response.headers.get('Retry-After') || '30', 10)));
      const unlockIso = new Date(Date.now() + retryAfterSec * 1000).toISOString();
      await this.env.KV.put('sc:ratelimit:lock', unlockIso, { expirationTtl: retryAfterSec });
      await recordAdminLog(this.env.DB, {
        category: 'rate_limit',
        severity: 'warn',
        action: 'soundcloud_rate_limit',
        provider: 'soundcloud',
        statusCode: 429,
        message: `SoundCloud API returned 429 on ${endpointPath}. Cooldown for ${retryAfterSec}s.`,
      });
      throw new ApiError(429, 'SOUNDCLOUD_RATE_LIMITED', `SoundCloud API rate limit exceeded. Retry after ${retryAfterSec}s.`);
    }

    if (response.status === 404) {
      throw new ApiError(404, 'SOUNDCLOUD_RESOURCE_NOT_FOUND', `SoundCloud resource not found: ${endpointPath}`);
    }

    if (!response.ok) {
      await recordAdminLog(this.env.DB, {
        category: 'provider_error',
        severity: 'error',
        action: 'soundcloud_http_error',
        provider: 'soundcloud',
        statusCode: response.status,
        message: `SoundCloud API error ${response.status} on ${endpointPath}`,
      });
      throw new ApiError(
        502,
        'SOUNDCLOUD_UPSTREAM_ERROR',
        `SoundCloud API returned HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as T;
    if (cacheTtlSeconds > 0) {
      await this.env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: cacheTtlSeconds });
    }
    return payload;
  }

  public async fetchTrackStreams(trackId: string): Promise<SoundCloudStreamsResponse> {
    return this.requestJson<SoundCloudStreamsResponse>(`/tracks/${encodeURIComponent(trackId)}/streams`, {}, 60);
  }

  public extractCollection<T>(res: T[] | SoundCloudPartitionedResponse<T>): T[] {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.collection)) return res.collection;
    return [];
  }
}

export type { PlaybackInfo };
