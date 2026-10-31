// ============================================================================
// POHUMUSIC — UNIFIED MUSIC PROVIDER INTERFACE & CANONICAL TYPES
// ============================================================================

export type ProviderSource = 'soundcloud' | 'youtube';

export type TrackAccessState = 'playable' | 'preview' | 'blocked';

export interface SoundCloudMetricBreakdown {
  /** Original unmodified play count returned by the provider */
  rawPlayCount: number;
  /** Separate calculated indicator equal to floor(rawPlayCount / 2). Never labeled as official SoundCloud stats. */
  calculatedHalvedDisplayScore: number;
  /** Explicit flag ensuring UI and API consumers never treat the calculated score as official provider telemetry */
  isOfficialStatistic: false;
  calculationFormula: 'floor(raw_playback_count / 2)';
}

/**
 * Canonical Track representation across SoundCloud and YouTube providers.
 * Note: Audio files are never stored or proxied on PohuMusic servers.
 */
export interface Track {
  id: string;
  provider: ProviderSource;
  providerTrackId: string;
  urn?: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle: string | null;
  durationMs: number;
  artworkUrl: string | null;
  permalinkUrl: string;
  accessState: TrackAccessState;
  streamable: boolean;
  genre: string | null;
  tags: string[];
  language: 'ru' | 'en' | 'any' | 'instrumental';
  releaseDate: string | null;
  rawPlayCount: number;
  likesCount: number;
  soundcloudMetrics?: SoundCloudMetricBreakdown;
}

export interface Artist {
  id: string;
  provider: ProviderSource;
  providerArtistId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number;
  trackCount: number;
  permalinkUrl: string;
  verified: boolean;
}

export interface Album {
  id: string;
  provider: ProviderSource;
  providerAlbumId: string;
  title: string;
  artistId: string;
  artistName: string;
  artworkUrl: string | null;
  releaseDate: string | null;
  trackCount: number;
  albumType: 'album' | 'playlist' | 'ep' | 'single';
  permalinkUrl: string;
  tracks: Track[];
}

export interface PlaybackInfo {
  trackId: string;
  provider: ProviderSource;
  accessState: TrackAccessState;
  canPlayFullTrack: boolean;
  canPlayPreview: boolean;
  reasonIfRestricted: string | null;
  playbackMode: 'soundcloud_widget_or_hls' | 'soundcloud_preview_snip' | 'youtube_official_embed' | 'blocked';
  officialEmbedUrl: string | null;
  authorizedStreamEndpoint: string | null;
  previewEndpoint: string | null;
  permalinkUrl: string;
  expiresAt: string | null;
}

export interface SearchQueryOptions {
  limit?: number;
  offset?: number;
  accessStates?: TrackAccessState[];
}

/**
 * Section 5: Unified MusicProvider Interface
 * Both SoundCloudProvider and YouTubeProvider implement this exact contract.
 */
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
