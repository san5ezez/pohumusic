// ============================================================================
// POHUMUSIC — ALBUMS ROUTES (/api/v1/albums/*)
// ============================================================================
// Implements:
// - GET /albums/search
// - GET /albums/:id
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { parsePagination, sanitizeText } from '../middleware/validation';
import type { ProviderSource } from '../providers/music-provider';
import { UnifiedMusicService } from '../services/aggregator';

export const albumsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/albums/search
albumsRouter.get('/search', async (c) => {
  const q = sanitizeText(c.req.query('q') || '', 'q', 160, true);
  const providerParam = (c.req.query('provider') || 'all').toLowerCase();
  const provider: 'all' | ProviderSource =
    providerParam === 'soundcloud' || providerParam === 'youtube' ? providerParam : 'all';
  const { limit, offset } = parsePagination({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  const service = new UnifiedMusicService(c.env);
  const albums = await service.searchAlbums(q, provider, { limit, offset });

  return c.json({
    query: q,
    provider,
    count: albums.length,
    albums,
  });
});

// GET /api/v1/albums/:id
albumsRouter.get('/:id', async (c) => {
  const id = sanitizeText(c.req.param('id'), 'id', 120, false);
  const service = new UnifiedMusicService(c.env);
  const album = await service.getAlbum(id);

  return c.json({
    album,
  });
});
