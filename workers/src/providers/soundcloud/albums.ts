// ============================================================================
// POHUMUSIC — SOUNDCLOUD ALBUMS OPERATIONS
// ============================================================================

import { ApiError } from '../../utils/errors';
import type { Album } from '../music-provider';
import {
  mapSoundCloudPlaylistToAlbum,
  SOUNDCLOUD_PLAYLISTS_SEED,
  SoundCloudClient,
} from './soundcloud';
import type { SoundCloudApiPlaylist } from './types';

function stripScAlbumPrefix(id: string): string {
  return id.replace(/^sc_album_/, '').replace(/^sc_playlist_/, '').replace(/^sc_/, '');
}

export async function getSoundCloudAlbum(
  client: SoundCloudClient,
  id: string
): Promise<Album | null> {
  const rawId = stripScAlbumPrefix(id);

  if (client.isLiveApiConfigured()) {
    try {
      const playlist = await client.requestJson<SoundCloudApiPlaylist>(
        `/playlists/${encodeURIComponent(rawId)}`,
        { show_tracks: true }
      );
      return mapSoundCloudPlaylistToAlbum(playlist);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  const found = SOUNDCLOUD_PLAYLISTS_SEED.find((p) => String(p.id) === rawId);
  return found ? mapSoundCloudPlaylistToAlbum(found) : null;
}
