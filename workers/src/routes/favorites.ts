// ============================================================================
// POHUMUSIC — FAVORITES ROUTES (/api/v1/library/favorites/*)
// ============================================================================
// Implements:
// - GET    /library/favorites
// - POST   /library/favorites (Idempotent)
// - DELETE /library/favorites/:trackId
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { requireAuthMiddleware } from '../middleware/auth';
import { sanitizeText } from '../middleware/validation';
import type { Track } from '../providers/music-provider';
import { UnifiedMusicService } from '../services/aggregator';
import { generateId, nowIso } from '../utils/id';

export const favoritesRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/library/favorites
favoritesRouter.get('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const rowsRes = await c.env.DB.prepare(
    `SELECT id, track_id, provider, title, artist_id, artist_name, album_id,
            album_title, duration_ms, artwork_url, access_state, track_json,
            version, created_at, updated_at
     FROM favorites
     WHERE user_id = ?
     ORDER BY created_at DESC`
  )
    .bind(user.id)
    .all<{
      id: string;
      track_id: string;
      track_json: string;
      version: number;
      created_at: string;
      updated_at: string;
    }>();

  const favorites = rowsRes.results.map((r) => ({
    favoriteId: r.id,
    trackId: r.track_id,
    track: JSON.parse(r.track_json) as Track,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return c.json({
    count: favorites.length,
    favorites,
  });
});

// POST /api/v1/library/favorites
favoritesRouter.post('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as {
    trackId?: string;
    track?: Track;
  };

  const trackId = sanitizeText(body.trackId || body.track?.id, 'trackId', 120, false);

  // Check idempotency: if already in favorites, return existing record
  const existing = await c.env.DB.prepare(
    'SELECT id, track_json, version, created_at, updated_at FROM favorites WHERE user_id = ? AND track_id = ?'
  )
    .bind(user.id, trackId)
    .first<{
      id: string;
      track_json: string;
      version: number;
      created_at: string;
      updated_at: string;
    }>();

  if (existing) {
    return c.json({
      favoriteId: existing.id,
      trackId,
      track: JSON.parse(existing.track_json) as Track,
      version: existing.version,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
      idempotentReplay: true,
    });
  }

  let track: Track;
  if (body.track && body.track.id === trackId && body.track.title) {
    track = body.track;
  } else {
    const service = new UnifiedMusicService(c.env);
    track = await service.getTrack(trackId);
  }

  const favId = generateId('fav');
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO favorites (
      id, user_id, track_id, provider, title, artist_id, artist_name,
      album_id, album_title, duration_ms, artwork_url, access_state,
      track_json, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(
      favId,
      user.id,
      track.id,
      track.provider,
      track.title,
      track.artistId,
      track.artistName,
      track.albumId,
      track.albumTitle,
      track.durationMs,
      track.artworkUrl,
      track.accessState,
      JSON.stringify(track),
      now,
      now
    )
    .run();

  return c.json(
    {
      favoriteId: favId,
      trackId: track.id,
      track,
      version: 1,
      createdAt: now,
      updatedAt: now,
      idempotentReplay: false,
    },
    201
  );
});

// DELETE /api/v1/library/favorites/:trackId
favoritesRouter.delete('/:trackId', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const trackId = sanitizeText(c.req.param('trackId'), 'trackId', 120, false);

  const res = await c.env.DB.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND track_id = ?'
  )
    .bind(user.id, trackId)
    .run();

  return c.json({
    success: true,
    removedTrackId: trackId,
    deleted: (res.meta.changes || 0) > 0,
  });
});
