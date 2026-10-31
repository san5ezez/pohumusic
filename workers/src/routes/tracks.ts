// ============================================================================
// POHUMUSIC — TRACKS ROUTES (/api/v1/tracks/*)
// ============================================================================
// Implements:
// - GET /tracks/search
// - GET /tracks/:id
// - GET /tracks/:id/related
// - GET /tracks/:id/playback
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { parsePagination, sanitizeText } from '../middleware/validation';
import type { ProviderSource, TrackAccessState } from '../providers/music-provider';
import { UnifiedMusicService } from '../services/aggregator';

export const tracksRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/tracks/search
tracksRouter.get('/search', async (c) => {
  const q = sanitizeText(c.req.query('q') || '', 'q', 160, true);
  const providerParam = (c.req.query('provider') || 'all').toLowerCase();
  const provider: 'all' | ProviderSource =
    providerParam === 'soundcloud' || providerParam === 'youtube' ? providerParam : 'all';

  const accessParam = c.req.query('access');
  const accessStates = accessParam
    ? (accessParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s === 'playable' || s === 'preview' || s === 'blocked') as TrackAccessState[])
    : undefined;

  const { limit, offset } = parsePagination({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  const service = new UnifiedMusicService(c.env);
  const tracks = await service.searchTracks(q, provider, {
    limit,
    offset,
    accessStates,
  });

  return c.json({
    query: q,
    provider,
    count: tracks.length,
    tracks,
  });
});

// GET /api/v1/tracks/:id
tracksRouter.get('/:id', async (c) => {
  const id = sanitizeText(c.req.param('id'), 'id', 120, false);
  const service = new UnifiedMusicService(c.env);
  const [track, playback] = await Promise.all([
    service.getTrack(id),
    service.getPlaybackInfo(id),
  ]);

  return c.json({
    track,
    playback,
  });
});

// GET /api/v1/tracks/:id/related
tracksRouter.get('/:id/related', async (c) => {
  const id = sanitizeText(c.req.param('id'), 'id', 120, false);
  const { limit } = parsePagination({ limit: c.req.query('limit') });
  const service = new UnifiedMusicService(c.env);
  const related = await service.getRelatedTracks(id, limit);

  return c.json({
    seedTrackId: id,
    count: related.length,
    tracks: related,
  });
});

// GET /api/v1/tracks/:id/playback
tracksRouter.get('/:id/playback', async (c) => {
  const id = sanitizeText(c.req.param('id'), 'id', 120, false);
  const service = new UnifiedMusicService(c.env);
  const playback = await service.getPlaybackInfo(id);
  return c.json({ playback });
});
