// ============================================================================
// POHUMUSIC — SOUNDCLOUD PROVIDER IMPLEMENTATION (MusicProvider)
// ============================================================================

import type { Env } from '../../config';
import type {
  Album,
  Artist,
  MusicProvider,
  PlaybackInfo,
  SearchQueryOptions,
  Track,
} from '../music-provider';
import { getSoundCloudAlbum } from './albums';
import { getSoundCloudArtist, getSoundCloudArtistTracks } from './artists';
import { getSoundCloudPlaylist, listSoundCloudPlaylists } from './playlists';
import {
  searchSoundCloudAlbums,
  searchSoundCloudArtists,
  searchSoundCloudTracks,
} from './search';
import { SoundCloudClient } from './soundcloud';
import {
  getSoundCloudPlaybackInfo,
  getSoundCloudRelatedTracks,
  getSoundCloudTrack,
} from './tracks';

export class SoundCloudProvider implements MusicProvider {
  public readonly providerName = 'soundcloud' as const;
  private readonly client: SoundCloudClient;

  constructor(env: Env, customFetch?: typeof fetch) {
    this.client = new SoundCloudClient(env, customFetch);
  }

  public async searchTracks(query: string, options?: SearchQueryOptions): Promise<Track[]> {
    return searchSoundCloudTracks(this.client, query, options);
  }

  public async searchArtists(query: string, options?: SearchQueryOptions): Promise<Artist[]> {
    return searchSoundCloudArtists(this.client, query, options);
  }

  public async searchAlbums(query: string, options?: SearchQueryOptions): Promise<Album[]> {
    return searchSoundCloudAlbums(this.client, query, options);
  }

  public async getTrack(id: string): Promise<Track | null> {
    return getSoundCloudTrack(this.client, id);
  }

  public async getArtist(id: string): Promise<Artist | null> {
    return getSoundCloudArtist(this.client, id);
  }

  public async getArtistTracks(id: string, limit = 20): Promise<Track[]> {
    return getSoundCloudArtistTracks(this.client, id, limit);
  }

  public async getAlbum(id: string): Promise<Album | null> {
    return getSoundCloudAlbum(this.client, id);
  }

  public async getPlaylist(id: string): Promise<Album | null> {
    return getSoundCloudPlaylist(this.client, id);
  }

  public async listPlaylists(query = '', limit = 20): Promise<Album[]> {
    return listSoundCloudPlaylists(this.client, query, limit);
  }

  public async getPlaybackInfo(id: string): Promise<PlaybackInfo> {
    return getSoundCloudPlaybackInfo(this.client, id);
  }

  public async getRelatedTracks(id: string, limit = 10): Promise<Track[]> {
    return getSoundCloudRelatedTracks(this.client, id, limit);
  }
}

export * from './types';
export * from './soundcloud';
export * from './auth';
