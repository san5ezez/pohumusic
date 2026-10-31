// ============================================================================
// POHUMUSIC — ARTISTS ROUTES (/api/v1/artists/*)
// ============================================================================
// Implements:
// - GET /artists/search
// - GET /artists/:id
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { parsePagination, sanitizeText } from '../middleware/validation';
import type { ProviderSource } from '../providers/music-provider';
import { UnifiedMusicService } from '../services/aggregator';

export const artistsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/artists/search
artistsRouter.get('/search', async (c) => {
  const q = sanitizeText(c.req.query('q') || '', 'q', 160, true);
  const providerParam = (c.req.query('provider') || 'all').toLowerCase();
  const provider: 'all' | ProviderSource =
    providerParam === 'soundcloud' || providerParam === 'youtube' ? providerParam : 'all';
  const { limit, offset } = parsePagination({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  const service = new UnifiedMusicService(c.env);
  const artists = await service.searchArtists(q, provider, { limit, offset });

  return c.json({
    query: q,
    provider,
    count: artists.length,
    artists,
  });
});

// GET /api/v1/artists/:id
artistsRouter.get('/:id', async (c) => {
  const id = sanitizeText(c.req.param('id'), 'id', 120, false);
  const service = new UnifiedMusicService(c.env);
  const { artist, topTracks } = await service.getArtist(id);

  return c.json({
    artist,
    topTracks,
  });
});
