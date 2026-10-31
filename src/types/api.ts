// ============================================================================
// POHUMUSIC — FRONTEND API CLIENT TYPES
// ============================================================================

export type ProviderSource = 'soundcloud' | 'youtube';
export type TrackAccessState = 'playable' | 'preview' | 'blocked';

export interface SoundCloudMetricBreakdown {
  rawPlayCount: number;
  calculatedHalvedDisplayScore: number;
  isOfficialStatistic: false;
  calculationFormula: 'floor(raw_playback_count / 2)';
}

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

export interface PlaybackInfo {
  trackId: string;
  provider: ProviderSource;
  accessState: TrackAccessState;
  canPlayFullTrack: boolean;
  canPlayPreview: boolean;
  reasonIfRestricted: string | null;
  playbackMode: string;
  officialEmbedUrl: string | null;
  authorizedStreamEndpoint: string | null;
  previewEndpoint: string | null;
  permalinkUrl: string;
  expiresAt: string | null;
}

export interface PlayerDeviceSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  isActiveDevice: boolean;
  currentTrackId: string | null;
  currentTrack: Track | null;
  positionMs: number;
  isPlaying: boolean;
  volume: number;
  repeatMode: 'off' | 'one' | 'all';
  shuffleEnabled: boolean;
  version: number;
  updatedAt: string;
}

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
