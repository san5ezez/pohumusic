// ============================================================================
// POHUMUSIC — SOUNDCLOUD SEARCH OPERATIONS
// ============================================================================

import type { Album, Artist, SearchQueryOptions, Track } from '../music-provider';
import {
  mapSoundCloudPlaylistToAlbum,
  mapSoundCloudTrackToCanonical,
  mapSoundCloudUserToArtist,
  SOUNDCLOUD_CATALOG_SEED,
  SOUNDCLOUD_PLAYLISTS_SEED,
  SoundCloudClient,
} from './soundcloud';
import type {
  SoundCloudApiPlaylist,
  SoundCloudApiTrack,
  SoundCloudApiUser,
  SoundCloudPartitionedResponse,
} from './types';

export async function searchSoundCloudTracks(
  client: SoundCloudClient,
  query: string,
  options: SearchQueryOptions = {}
): Promise<Track[]> {
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const accessFilter = options.accessStates?.length
    ? options.accessStates.join(',')
    : 'playable,preview,blocked';

  if (client.isLiveApiConfigured()) {
    const res = await client.requestJson<
      SoundCloudApiTrack[] | SoundCloudPartitionedResponse<SoundCloudApiTrack>
    >('/tracks', {
      q: query,
      limit,
      offset: options.offset ?? 0,
      access: accessFilter,
      linked_partitioning: true,
    });
    return client.extractCollection(res).map(mapSoundCloudTrackToCanonical);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = SOUNDCLOUD_CATALOG_SEED.filter((t) => {
    if (!normalizedQuery) return true;
    const haystack = `${t.title} ${t.user.username} ${t.user.full_name || ''} ${t.genre || ''} ${t.tag_list || ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const mapped = filtered.map(mapSoundCloudTrackToCanonical);
  const accessFiltered = options.accessStates?.length
    ? mapped.filter((t) => options.accessStates!.includes(t.accessState))
    : mapped;

  return accessFiltered.slice(options.offset ?? 0, (options.offset ?? 0) + limit);
}

export async function searchSoundCloudArtists(
  client: SoundCloudClient,
  query: string,
  options: SearchQueryOptions = {}
): Promise<Artist[]> {
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));

  if (client.isLiveApiConfigured()) {
    const res = await client.requestJson<
      SoundCloudApiUser[] | SoundCloudPartitionedResponse<SoundCloudApiUser>
    >('/users', {
      q: query,
      limit,
      offset: options.offset ?? 0,
      linked_partitioning: true,
    });
    return client.extractCollection(res).map(mapSoundCloudUserToArtist);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const uniqueUsers = new Map<string, SoundCloudApiUser>();
  for (const track of SOUNDCLOUD_CATALOG_SEED) {
    uniqueUsers.set(String(track.user.id), track.user);
  }

  const results = Array.from(uniqueUsers.values())
    .filter((u) => {
      if (!normalizedQuery) return true;
      const haystack = `${u.username} ${u.full_name || ''} ${u.description || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .map(mapSoundCloudUserToArtist);

  return results.slice(options.offset ?? 0, (options.offset ?? 0) + limit);
}

export async function searchSoundCloudAlbums(
  client: SoundCloudClient,
  query: string,
  options: SearchQueryOptions = {}
): Promise<Album[]> {
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));

  if (client.isLiveApiConfigured()) {
    const res = await client.requestJson<
      SoundCloudApiPlaylist[] | SoundCloudPartitionedResponse<SoundCloudApiPlaylist>
    >('/playlists', {
      q: query,
      limit,
      offset: options.offset ?? 0,
      show_tracks: true,
      linked_partitioning: true,
    });
    return client.extractCollection(res).map(mapSoundCloudPlaylistToAlbum);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = SOUNDCLOUD_PLAYLISTS_SEED.filter((p) => {
    if (!normalizedQuery) return true;
    const haystack = `${p.title} ${p.description || ''} ${p.user.username}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  }).map(mapSoundCloudPlaylistToAlbum);

  return filtered.slice(options.offset ?? 0, (options.offset ?? 0) + limit);
}
