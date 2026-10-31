// ============================================================================
// POHUMUSIC — YOUTUBE PROVIDER IMPLEMENTATION (MusicProvider)
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
import type { YouTubeQuotaStatus } from './types';
import { YouTubeClient } from './youtube';

export class YouTubeProvider implements MusicProvider {
  public readonly providerName = 'youtube' as const;
  private readonly client: YouTubeClient;

  constructor(env: Env, customFetch?: typeof fetch) {
    this.client = new YouTubeClient(env, customFetch);
  }

  public async searchTracks(query: string, options?: SearchQueryOptions): Promise<Track[]> {
    return this.client.searchTracks(query, options);
  }

  public async searchArtists(query: string, options?: SearchQueryOptions): Promise<Artist[]> {
    return this.client.searchArtists(query, options);
  }

  public async searchAlbums(query: string, options?: SearchQueryOptions): Promise<Album[]> {
    return this.client.searchAlbums(query, options);
  }

  public async getTrack(id: string): Promise<Track | null> {
    return this.client.getTrack(id);
  }

  public async getArtist(id: string): Promise<Artist | null> {
    return this.client.getArtist(id);
  }

  public async getAlbum(id: string): Promise<Album | null> {
    return this.client.getAlbum(id);
  }

  public async getPlaybackInfo(id: string): Promise<PlaybackInfo> {
    return this.client.getPlaybackInfo(id);
  }

  public async getRelatedTracks(id: string, limit = 10): Promise<Track[]> {
    return this.client.getRelatedTracks(id, limit);
  }

  public async getQuotaStatus(): Promise<YouTubeQuotaStatus> {
    return this.client.getQuotaStatus();
  }
}

export * from './types';
export * from './youtube';
