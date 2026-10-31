// ============================================================================
// POHUMUSIC — SOUNDCLOUD OAUTH 2.1 CLIENT CREDENTIALS & TOKEN CACHING
// ============================================================================

import type { Env } from '../../config';
import { ApiError } from '../../utils/errors';
import type { SoundCloudTokenResponse } from './types';

const SC_TOKEN_KV_KEY = 'sc:oauth:access_token';

/**
 * Manages SoundCloud OAuth 2.1 Client Credentials token acquisition and KV caching.
 * Secrets (SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_CLIENT_SECRET) remain strictly server-side
 * in Cloudflare Secrets.
 */
export class SoundCloudAuthManager {
  private env: Env;
  private customFetch: typeof fetch;

  constructor(env: Env, customFetch: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.env = env;
    this.customFetch = customFetch;
  }

  public hasCredentials(): boolean {
    return Boolean(this.env.SOUNDCLOUD_CLIENT_ID && this.env.SOUNDCLOUD_CLIENT_SECRET);
  }

  public async getAccessToken(forceRefresh = false): Promise<string | null> {
    if (!this.hasCredentials()) {
      return null;
    }

    if (!forceRefresh) {
      const cached = (await this.env.KV.get(SC_TOKEN_KV_KEY, { type: 'text' })) as string | null;
      if (cached) {
        return cached;
      }
    }

    const tokenUrl = this.env.SOUNDCLOUD_TOKEN_URL || 'https://secure.soundcloud.com/oauth/token';
    const credentials = btoa(`${this.env.SOUNDCLOUD_CLIENT_ID}:${this.env.SOUNDCLOUD_CLIENT_SECRET}`);

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
    });

    const response = await this.customFetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json; charset=utf-8',
      },
      body: body.toString(),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      throw new ApiError(
        429,
        'SOUNDCLOUD_AUTH_RATE_LIMITED',
        `SoundCloud OAuth token endpoint rate limited. Retry after ${retryAfter}s.`
      );
    }

    if (!response.ok) {
      throw new ApiError(
        502,
        'SOUNDCLOUD_AUTH_FAILED',
        `SoundCloud OAuth token request failed with status ${response.status}`
      );
    }

    const data = (await response.json()) as SoundCloudTokenResponse;
    const ttl = Math.max(60, (data.expires_in || 3600) - 120);
    await this.env.KV.put(SC_TOKEN_KV_KEY, data.access_token, { expirationTtl: ttl });
    return data.access_token;
  }
}
