export type ProviderSource = 'soundcloud' | 'youtube';
export type AccessState = 'playable' | 'preview' | 'blocked';

export interface Track {
  id: string;
  provider: ProviderSource;
  title: string;
  artist: string;
  artistName?: string;
  album?: string;
  albumTitle?: string;
  durationSeconds: number;
  durationMs?: number;
  artworkUrl?: string;
  externalUrl: string;
  permalinkUrl?: string;
  accessState: AccessState;
  isRestricted?: boolean;
  previewSeconds?: number;
  rawPlayCount?: number;
  displayScore?: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  emailVerified: boolean;
  avatarUrl?: string;
  bio?: string;
  usernameChangedAt?: string;
  version: number;
}

export interface Playlist {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic: boolean;
  tracksCount: number;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackArtworkUrl?: string;
  provider: ProviderSource;
  listenedSeconds: number;
  completed: boolean;
  playedAt: string;
}

export interface RecommendationItem {
  track: Track;
  score: number;
  reason: string;
}

export interface HotkeyConfig {
  playPause: string; // default "Space"
  nextTrack: string; // default "ArrowRight"
  prevTrack: string; // default "ArrowLeft"
  volumeUp: string;  // default "ArrowUp"
  volumeDown: string;// default "ArrowDown"
}
