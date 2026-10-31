// ============================================================================
// POHUMUSIC — SOUNDCLOUD TRACK METADATA, RELATED TRACKS & PLAYBACK RESOLUTION
// ============================================================================

import { ApiError } from '../../utils/errors';
import type { PlaybackInfo, Track } from '../music-provider';
import {
  mapSoundCloudTrackToCanonical,
  SOUNDCLOUD_CATALOG_SEED,
  SoundCloudClient,
} from './soundcloud';
import type { SoundCloudApiTrack, SoundCloudPartitionedResponse } from './types';

function stripScTrackPrefix(id: string): string {
  return id.replace(/^sc_/, '');
}

export async function getSoundCloudTrack(
  client: SoundCloudClient,
  id: string
): Promise<Track | null> {
  const rawId = stripScTrackPrefix(id);

  if (client.isLiveApiConfigured()) {
    try {
      const apiTrack = await client.requestJson<SoundCloudApiTrack>(
        `/tracks/${encodeURIComponent(rawId)}`
      );
      return mapSoundCloudTrackToCanonical(apiTrack);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  const found = SOUNDCLOUD_CATALOG_SEED.find((t) => String(t.id) === rawId);
  return found ? mapSoundCloudTrackToCanonical(found) : null;
}

export async function getSoundCloudRelatedTracks(
  client: SoundCloudClient,
  id: string,
  limit = 10
): Promise<Track[]> {
  const rawId = stripScTrackPrefix(id);

  if (client.isLiveApiConfigured()) {
    const res = await client.requestJson<
      SoundCloudApiTrack[] | SoundCloudPartitionedResponse<SoundCloudApiTrack>
    >(`/tracks/${encodeURIComponent(rawId)}/related`, {
      limit,
      access: 'playable,preview',
      linked_partitioning: true,
    });
    return client.extractCollection(res).map(mapSoundCloudTrackToCanonical);
  }

  const source = SOUNDCLOUD_CATALOG_SEED.find((t) => String(t.id) === rawId);
  const candidates = SOUNDCLOUD_CATALOG_SEED.filter((t) => String(t.id) !== rawId);
  if (!source) {
    return candidates.slice(0, limit).map(mapSoundCloudTrackToCanonical);
  }

  const sourceTags = new Set((source.tag_list || '').toLowerCase().split(/\s+/));
  const scored = candidates
    .map((candidate) => {
      let score = 0;
      if (candidate.genre && candidate.genre === source.genre) score += 3;
      if (candidate.user.id === source.user.id) score += 2;
      const candTags = (candidate.tag_list || '').toLowerCase().split(/\s+/);
      for (const tag of candTags) {
        if (sourceTags.has(tag)) score += 1;
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => mapSoundCloudTrackToCanonical(item.candidate));
}

/**
 * Resolves permitted SoundCloud playback info strictly respecting `access` states
 * ('playable', 'preview', 'blocked'). Never bypasses restrictions or downloads audio.
 */
export async function getSoundCloudPlaybackInfo(
  client: SoundCloudClient,
  id: string
): Promise<PlaybackInfo> {
  const track = await getSoundCloudTrack(client, id);
  if (!track) {
    throw new ApiError(404, 'TRACK_NOT_FOUND', `SoundCloud track ${id} not found`);
  }

  const rawId = track.providerTrackId;
  const widgetEmbedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    `https://api.soundcloud.com/tracks/${rawId}`
  )}&color=%23f59e0b&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;

  if (track.accessState === 'blocked' || !track.streamable) {
    return {
      trackId: track.id,
      provider: 'soundcloud',
      accessState: 'blocked',
      canPlayFullTrack: false,
      canPlayPreview: false,
      reasonIfRestricted:
        'Playback is blocked by the rights holder or regional SoundCloud policy. PohuMusic does not bypass access restrictions.',
      playbackMode: 'blocked',
      officialEmbedUrl: null,
      authorizedStreamEndpoint: null,
      previewEndpoint: null,
      permalinkUrl: track.permalinkUrl,
      expiresAt: null,
    };
  }

  let authorizedStreamEndpoint: string | null = null;
  let previewEndpoint: string | null = null;

  if (client.isLiveApiConfigured()) {
    try {
      const streams = await client.fetchTrackStreams(rawId);
      authorizedStreamEndpoint =
        streams.hls_mp3_128_url || streams.http_mp3_128_url || streams.hls_opus_64_url || null;
      previewEndpoint = streams.preview_mp3_128_url || null;
    } catch {
      // Fallback to official SoundCloud Widget player if direct stream endpoint requires widget context
    }
  } else {
    if (track.accessState === 'playable') {
      authorizedStreamEndpoint = `https://api.soundcloud.com/tracks/${rawId}/streams`;
    }
    previewEndpoint = `https://api.soundcloud.com/tracks/${rawId}/streams/preview`;
  }

  if (track.accessState === 'preview') {
    return {
      trackId: track.id,
      provider: 'soundcloud',
      accessState: 'preview',
      canPlayFullTrack: false,
      canPlayPreview: true,
      reasonIfRestricted:
        'This track is restricted to a 30-second preview (SoundCloud Go+ / rights holder policy).',
      playbackMode: 'soundcloud_preview_snip',
      officialEmbedUrl: widgetEmbedUrl,
      authorizedStreamEndpoint: null,
      previewEndpoint,
      permalinkUrl: track.permalinkUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  return {
    trackId: track.id,
    provider: 'soundcloud',
    accessState: 'playable',
    canPlayFullTrack: true,
    canPlayPreview: true,
    reasonIfRestricted: null,
    playbackMode: 'soundcloud_widget_or_hls',
    officialEmbedUrl: widgetEmbedUrl,
    authorizedStreamEndpoint,
    previewEndpoint,
    permalinkUrl: track.permalinkUrl,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}
