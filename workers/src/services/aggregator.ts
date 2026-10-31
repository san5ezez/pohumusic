// ============================================================================
// POHUMUSIC — UNIFIED MULTI-PROVIDER MUSIC AGGREGATOR SERVICE
// ============================================================================

import type { Env } from '../config';
import type {
  Album,
  Artist,
  PlaybackInfo,
  ProviderSource,
  SearchQueryOptions,
  Track,
} from '../providers/music-provider';
import { SoundCloudProvider } from '../providers/soundcloud';
import { YouTubeProvider } from '../providers/youtube';
import { ApiError } from '../utils/errors';

export class UnifiedMusicService {
  public readonly soundcloud: SoundCloudProvider;
  public readonly youtube: YouTubeProvider;

  constructor(env: Env, customFetch?: typeof fetch) {
    this.soundcloud = new SoundCloudProvider(env, customFetch);
    this.youtube = new YouTubeProvider(env, customFetch);
  }

  private resolveProviderById(id: string, explicitProvider?: string): ProviderSource {
    if (explicitProvider === 'youtube' || id.startsWith('yt_')) return 'youtube';
    return 'soundcloud';
  }

  public async searchTracks(
    query: string,
    providerFilter: 'all' | ProviderSource = 'all',
    options?: SearchQueryOptions
  ): Promise<Track[]> {
    if (providerFilter === 'soundcloud') {
      return this.soundcloud.searchTracks(query, options);
    }
    if (providerFilter === 'youtube') {
      return this.youtube.searchTracks(query, options);
    }

    const [scTracks, ytTracks] = await Promise.all([
      this.soundcloud.searchTracks(query, options).catch(() => []),
      this.youtube.searchTracks(query, options).catch(() => []),
    ]);

    return [...scTracks, ...ytTracks];
  }

  public async searchArtists(
    query: string,
    providerFilter: 'all' | ProviderSource = 'all',
    options?: SearchQueryOptions
  ): Promise<Artist[]> {
    if (providerFilter === 'soundcloud') return this.soundcloud.searchArtists(query, options);
    if (providerFilter === 'youtube') return this.youtube.searchArtists(query, options);

    const [scArtists, ytArtists] = await Promise.all([
      this.soundcloud.searchArtists(query, options).catch(() => []),
      this.youtube.searchArtists(query, options).catch(() => []),
    ]);
    return [...scArtists, ...ytArtists];
  }

  public async searchAlbums(
    query: string,
    providerFilter: 'all' | ProviderSource = 'all',
    options?: SearchQueryOptions
  ): Promise<Album[]> {
    if (providerFilter === 'soundcloud') return this.soundcloud.searchAlbums(query, options);
    if (providerFilter === 'youtube') return this.youtube.searchAlbums(query, options);

    const [scAlbums, ytAlbums] = await Promise.all([
      this.soundcloud.searchAlbums(query, options).catch(() => []),
      this.youtube.searchAlbums(query, options).catch(() => []),
    ]);
    return [...scAlbums, ...ytAlbums];
  }

  public async getTrack(id: string): Promise<Track> {
    const provider = this.resolveProviderById(id);
    const track =
      provider === 'youtube'
        ? await this.youtube.getTrack(id)
        : await this.soundcloud.getTrack(id);

    if (!track) {
      throw new ApiError(404, 'TRACK_NOT_FOUND', `Track '${id}' was not found`);
    }
    return track;
  }

  public async getPlaybackInfo(id: string): Promise<PlaybackInfo> {
    const provider = this.resolveProviderById(id);
    return provider === 'youtube'
      ? this.youtube.getPlaybackInfo(id)
      : this.soundcloud.getPlaybackInfo(id);
  }

  public async getRelatedTracks(id: string, limit = 8): Promise<Track[]> {
    const provider = this.resolveProviderById(id);
    return provider === 'youtube'
      ? this.youtube.getRelatedTracks(id, limit)
      : this.soundcloud.getRelatedTracks(id, limit);
  }

  public async getArtist(id: string): Promise<{ artist: Artist; topTracks: Track[] }> {
    const provider = this.resolveProviderById(id);
    if (provider === 'youtube') {
      const artist = await this.youtube.getArtist(id);
      if (!artist) throw new ApiError(404, 'ARTIST_NOT_FOUND', `Artist '${id}' not found`);
      const allTracks = await this.youtube.searchTracks(artist.name);
      return { artist, topTracks: allTracks };
    }

    const artist = await this.soundcloud.getArtist(id);
    if (!artist) throw new ApiError(404, 'ARTIST_NOT_FOUND', `Artist '${id}' not found`);
    const topTracks = await this.soundcloud.getArtistTracks(id, 15);
    return { artist, topTracks };
  }

  public async getAlbum(id: string): Promise<Album> {
    const provider = this.resolveProviderById(id);
    const album =
      provider === 'youtube'
        ? await this.youtube.getAlbum(id)
        : await this.soundcloud.getAlbum(id);

    if (!album) {
      throw new ApiError(404, 'ALBUM_NOT_FOUND', `Album '${id}' not found`);
    }
    return album;
  }
}
