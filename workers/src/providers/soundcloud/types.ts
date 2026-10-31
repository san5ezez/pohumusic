// ============================================================================
// POHUMUSIC — SOUNDCLOUD OFFICIAL API v2 TYPES & PACKAGE VERIFICATION METADATA
// ============================================================================

import type { TrackAccessState } from '../music-provider';

/**
 * Section 3 Audit Record: Verification of `soundcloud.ts` npm package
 * Fixed and documented in code & PROVIDERS.md before implementation.
 */
export const SOUNDCLOUD_TS_PACKAGE_AUDIT = {
  npmPackageName: 'soundcloud.ts',
  npmUrl: 'https://www.npmjs.com/package/soundcloud.ts',
  repositoryUrl: 'https://github.com/Tenpi/soundcloud.ts',
  mirrorRepositoryUrl: 'https://github.com/Moestash/soundcloud.ts',
  documentationUrl: 'https://soundcloud-ts.js.org/',
  officialSoundCloudApiDocs: 'https://developers.soundcloud.com/docs/api/explorer/open-api',
  license: 'MIT',
  latestVerifiedVersion: '0.5.9',
  typescriptSupport: true,
  cloudflareWorkersCompatible: false,
  incompatibilityReasons: [
    'Depends on Node.js native/filesystem modules (fs, path, stream) and ffmpeg-static (~70MB platform binary), which cannot execute in Cloudflare Workers V8 isolates.',
    'Scrapes undocumented frontend client_id values and downloads/muxes raw streams, violating PohuMusic security rules against storing/downloading audio or bypassing access controls.',
  ],
  resolution:
    'Implemented native Web Fetch SoundCloud client in workers/src/providers/soundcloud/soundcloud.ts targeting the official SoundCloud API (https://api.soundcloud.com) and OAuth 2.1 token endpoint (https://secure.soundcloud.com/oauth/token) with zero Node.js-only dependencies.',
} as const;

export interface SoundCloudApiUser {
  id: number | string;
  urn?: string;
  username: string;
  full_name?: string;
  avatar_url?: string | null;
  description?: string | null;
  followers_count?: number;
  track_count?: number;
  permalink_url: string;
  verified?: boolean;
}

export interface SoundCloudApiTrack {
  id: number | string;
  urn?: string;
  title: string;
  duration: number;
  streamable?: boolean;
  access?: TrackAccessState; // 'playable' | 'preview' | 'blocked'
  artwork_url?: string | null;
  permalink_url: string;
  genre?: string | null;
  tag_list?: string;
  created_at?: string;
  release_date?: string | null;
  playback_count?: number;
  favoritings_count?: number;
  likes_count?: number;
  stream_url?: string | null;
  preview_mp3_128_url?: string | null;
  user: SoundCloudApiUser;
}

export interface SoundCloudApiPlaylist {
  id: number | string;
  urn?: string;
  title: string;
  description?: string | null;
  artwork_url?: string | null;
  permalink_url: string;
  track_count?: number;
  playlist_type?: string | null;
  SetType?: string | null;
  is_album?: boolean;
  created_at?: string;
  release_date?: string | null;
  user: SoundCloudApiUser;
  tracks?: SoundCloudApiTrack[];
}

export interface SoundCloudStreamsResponse {
  http_mp3_128_url?: string;
  hls_mp3_128_url?: string;
  hls_opus_64_url?: string;
  preview_mp3_128_url?: string;
}

export interface SoundCloudTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface SoundCloudPartitionedResponse<T> {
  collection: T[];
  next_href?: string | null;
}
