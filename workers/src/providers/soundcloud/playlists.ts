// ============================================================================
// POHUMUSIC — SOUNDCLOUD PLAYLISTS / SETS OPERATIONS
// ============================================================================

import type { Album } from '../music-provider';
import { getSoundCloudAlbum } from './albums';
import { searchSoundCloudAlbums } from './search';
import type { SoundCloudClient } from './soundcloud';

export async function getSoundCloudPlaylist(
  client: SoundCloudClient,
  playlistId: string
): Promise<Album | null> {
  return getSoundCloudAlbum(client, playlistId);
}

export async function listSoundCloudPlaylists(
  client: SoundCloudClient,
  query = '',
  limit = 20
): Promise<Album[]> {
  return searchSoundCloudAlbums(client, query, { limit });
}
