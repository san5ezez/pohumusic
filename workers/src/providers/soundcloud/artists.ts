// ============================================================================
// POHUMUSIC — SOUNDCLOUD ARTISTS OPERATIONS
// ============================================================================

import { ApiError } from '../../utils/errors';
import type { Artist, Track } from '../music-provider';
import {
  mapSoundCloudTrackToCanonical,
  mapSoundCloudUserToArtist,
  SOUNDCLOUD_CATALOG_SEED,
  SoundCloudClient,
} from './soundcloud';
import type {
  SoundCloudApiTrack,
  SoundCloudApiUser,
  SoundCloudPartitionedResponse,
} from './types';

function stripScArtistPrefix(id: string): string {
  return id.replace(/^sc_artist_/, '').replace(/^sc_/, '');
}

export async function getSoundCloudArtist(
  client: SoundCloudClient,
  id: string
): Promise<Artist | null> {
  const rawId = stripScArtistPrefix(id);

  if (client.isLiveApiConfigured()) {
    try {
      const user = await client.requestJson<SoundCloudApiUser>(
        `/users/${encodeURIComponent(rawId)}`
      );
      return mapSoundCloudUserToArtist(user);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  const found = SOUNDCLOUD_CATALOG_SEED.find((t) => String(t.user.id) === rawId)?.user;
  return found ? mapSoundCloudUserToArtist(found) : null;
}

export async function getSoundCloudArtistTracks(
  client: SoundCloudClient,
  id: string,
  limit = 20
): Promise<Track[]> {
  const rawId = stripScArtistPrefix(id);

  if (client.isLiveApiConfigured()) {
    const res = await client.requestJson<
      SoundCloudApiTrack[] | SoundCloudPartitionedResponse<SoundCloudApiTrack>
    >(`/users/${encodeURIComponent(rawId)}/tracks`, {
      limit,
      access: 'playable,preview,blocked',
      linked_partitioning: true,
    });
    return client.extractCollection(res).map(mapSoundCloudTrackToCanonical);
  }

  return SOUNDCLOUD_CATALOG_SEED.filter((t) => String(t.user.id) === rawId)
    .slice(0, limit)
    .map(mapSoundCloudTrackToCanonical);
}
