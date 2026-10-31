// ============================================================================
// POHUMUSIC — PLAYLISTS & PUBLIC SHARING ROUTES (/api/v1/playlists/*)
// ============================================================================
// Implements:
// - GET    /playlists
// - POST   /playlists (Enforces max 10 playlists per user!)
// - GET    /playlists/:id
// - PATCH  /playlists/:id (Owner verification + version concurrency check)
// - DELETE /playlists/:id
// - POST   /playlists/:id/tracks
// - DELETE /playlists/:id/tracks/:trackId
// - POST   /playlists/:id/share
// - GET    /playlists/public/:shareId
// ============================================================================

import { Hono } from 'hono';
import { APP_CONSTANTS, type AppVariables, type Env } from '../config';
import { optionalAuthMiddleware, requireAuthMiddleware } from '../middleware/auth';
import { sanitizeText } from '../middleware/validation';
import type { Track } from '../providers/music-provider';
import { UnifiedMusicService } from '../services/aggregator';
import { ApiError } from '../utils/errors';
import { generateId, generateShareToken, nowIso } from '../utils/id';

export const playlistsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/playlists/public/:shareId (Must be defined before /:id)
playlistsRouter.get('/public/:shareId', async (c) => {
  const shareId = sanitizeText(c.req.param('shareId'), 'shareId', 64, false);

  const shareRow = await c.env.DB.prepare(
    `SELECT s.share_id, s.playlist_id, s.access_count, s.is_active, s.expires_at,
            p.title, p.description, p.cover_url, p.track_count, p.version, p.created_at, p.updated_at,
            u.username as owner_username, u.display_name as owner_display_name
     FROM public_shares s
     JOIN playlists p ON p.id = s.playlist_id
     JOIN users u ON u.id = s.owner_user_id
     WHERE s.share_id = ?`
  )
    .bind(shareId)
    .first<{
      share_id: string;
      playlist_id: string;
      access_count: number;
      is_active: number;
      expires_at: string | null;
      title: string;
      description: string;
      cover_url: string | null;
      track_count: number;
      version: number;
      created_at: string;
      updated_at: string;
      owner_username: string;
      owner_display_name: string;
    }>();

  if (
    !shareRow ||
    shareRow.is_active === 0 ||
    (shareRow.expires_at && new Date(shareRow.expires_at).getTime() < Date.now())
  ) {
    throw new ApiError(404, 'SHARED_PLAYLIST_NOT_FOUND', 'Public shared playlist link is invalid or expired.');
  }

  await c.env.DB.prepare(
    'UPDATE public_shares SET access_count = access_count + 1, updated_at = ? WHERE share_id = ?'
  )
    .bind(nowIso(), shareId)
    .run();

  const tracksRes = await c.env.DB.prepare(
    `SELECT position, track_json, added_at
     FROM playlist_tracks
     WHERE playlist_id = ?
     ORDER BY position ASC`
  )
    .bind(shareRow.playlist_id)
    .all<{ position: number; track_json: string; added_at: string }>();

  return c.json({
    shareId: shareRow.share_id,
    accessCount: shareRow.access_count + 1,
    playlist: {
      id: shareRow.playlist_id,
      title: shareRow.title,
      description: shareRow.description,
      coverUrl: shareRow.cover_url,
      trackCount: shareRow.track_count,
      ownerUsername: shareRow.owner_username,
      ownerDisplayName: shareRow.owner_display_name,
      version: shareRow.version,
      createdAt: shareRow.created_at,
      updatedAt: shareRow.updated_at,
      tracks: tracksRes.results.map((t) => ({
        position: t.position,
        addedAt: t.added_at,
        track: JSON.parse(t.track_json) as Track,
      })),
    },
  });
});

// GET /api/v1/playlists
playlistsRouter.get('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const rowsRes = await c.env.DB.prepare(
    `SELECT p.id, p.title, p.description, p.is_public, p.cover_url,
            p.track_count, p.version, p.created_at, p.updated_at,
            s.share_id
     FROM playlists p
     LEFT JOIN public_shares s ON s.playlist_id = p.id AND s.is_active = 1
     WHERE p.user_id = ?
     ORDER BY p.updated_at DESC`
  )
    .bind(user.id)
    .all();

  return c.json({
    count: rowsRes.results.length,
    maxAllowed: APP_CONSTANTS.MAX_PLAYLISTS_PER_USER,
    playlists: rowsRes.results,
  });
});

// POST /api/v1/playlists
// Section 8: "Максимум 10 плейлистов на пользователя."
playlistsRouter.post('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = sanitizeText(body.title, 'title', 80, false);
  const description = sanitizeText(body.description, 'description', 300, true);
  const isPublic = Boolean(body.isPublic);
  const coverUrl = sanitizeText(body.coverUrl, 'coverUrl', 500, true) || null;

  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM playlists WHERE user_id = ?'
  )
    .bind(user.id)
    .first<{ cnt: number }>();

  const currentCount = Number(countRow?.cnt || 0);
  if (currentCount >= APP_CONSTANTS.MAX_PLAYLISTS_PER_USER) {
    throw new ApiError(
      400,
      'PLAYLIST_LIMIT_EXCEEDED',
      `Достигнут лимит: максимум ${APP_CONSTANTS.MAX_PLAYLISTS_PER_USER} плейлистов на одного пользователя.`
    );
  }

  const id = generateId('pl');
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO playlists (
      id, user_id, title, description, is_public, cover_url,
      track_count, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
  )
    .bind(id, user.id, title, description, isPublic ? 1 : 0, coverUrl, now, now)
    .run();

  return c.json(
    {
      playlist: {
        id,
        userId: user.id,
        title,
        description,
        isPublic,
        coverUrl,
        trackCount: 0,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    },
    201
  );
});

// GET /api/v1/playlists/:id
playlistsRouter.get('/:id', optionalAuthMiddleware, async (c) => {
  const id = sanitizeText(c.req.param('id'), 'id', 64, false);
  const authUser = c.get('user');

  const plRow = await c.env.DB.prepare(
    `SELECT p.*, u.username as owner_username, u.display_name as owner_display_name,
            s.share_id
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN public_shares s ON s.playlist_id = p.id AND s.is_active = 1
     WHERE p.id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      is_public: number;
      cover_url: string | null;
      track_count: number;
      version: number;
      created_at: string;
      updated_at: string;
      owner_username: string;
      owner_display_name: string;
      share_id: string | null;
    }>();

  if (!plRow) {
    throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
  }

  const isOwner = authUser?.id === plRow.user_id || authUser?.role === 'admin';
  if (plRow.is_public === 0 && !isOwner) {
    throw new ApiError(403, 'PLAYLIST_PRIVATE', 'This playlist is private.');
  }

  const tracksRes = await c.env.DB.prepare(
    `SELECT id, track_id, position, track_json, added_at
     FROM playlist_tracks
     WHERE playlist_id = ?
     ORDER BY position ASC`
  )
    .bind(id)
    .all<{
      id: string;
      track_id: string;
      position: number;
      track_json: string;
      added_at: string;
    }>();

  return c.json({
    playlist: {
      id: plRow.id,
      userId: plRow.user_id,
      ownerUsername: plRow.owner_username,
      ownerDisplayName: plRow.owner_display_name,
      title: plRow.title,
      description: plRow.description,
      isPublic: plRow.is_public === 1,
      coverUrl: plRow.cover_url,
      trackCount: plRow.track_count,
      shareId: plRow.share_id,
      version: plRow.version,
      createdAt: plRow.created_at,
      updatedAt: plRow.updated_at,
      tracks: tracksRes.results.map((r) => ({
        entryId: r.id,
        trackId: r.track_id,
        position: r.position,
        addedAt: r.added_at,
        track: JSON.parse(r.track_json) as Track,
      })),
    },
  });
});

// PATCH /api/v1/playlists/:id
playlistsRouter.patch('/:id', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const id = sanitizeText(c.req.param('id'), 'id', 64, false);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const plRow = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?')
    .bind(id)
    .first<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      is_public: number;
      cover_url: string | null;
      version: number;
    }>();

  if (!plRow) {
    throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
  }
  if (plRow.user_id !== user.id) {
    throw new ApiError(403, 'NOT_PLAYLIST_OWNER', 'Only the playlist owner can update this playlist.');
  }

  if (
    body.expectedVersion !== undefined &&
    Number(body.expectedVersion) !== plRow.version
  ) {
    throw new ApiError(
      409,
      'SYNC_VERSION_CONFLICT',
      `Playlist version conflict: expected ${body.expectedVersion}, server is at ${plRow.version}.`
    );
  }

  const nextTitle =
    body.title !== undefined ? sanitizeText(body.title, 'title', 80, false) : plRow.title;
  const nextDesc =
    body.description !== undefined
      ? sanitizeText(body.description, 'description', 300, true)
      : plRow.description;
  const nextPublic =
    body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : plRow.is_public;
  const nextVersion = plRow.version + 1;
  const now = nowIso();

  await c.env.DB.prepare(
    `UPDATE playlists
     SET title = ?, description = ?, is_public = ?, version = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(nextTitle, nextDesc, nextPublic, nextVersion, now, id)
    .run();

  return c.json({
    playlist: {
      id,
      title: nextTitle,
      description: nextDesc,
      isPublic: nextPublic === 1,
      version: nextVersion,
      updatedAt: now,
    },
  });
});

// DELETE /api/v1/playlists/:id
playlistsRouter.delete('/:id', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const id = sanitizeText(c.req.param('id'), 'id', 64, false);

  const plRow = await c.env.DB.prepare('SELECT id, user_id FROM playlists WHERE id = ?')
    .bind(id)
    .first<{ id: string; user_id: string }>();

  if (!plRow) {
    throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
  }
  if (plRow.user_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'NOT_PLAYLIST_OWNER', 'Only the playlist owner can delete this playlist.');
  }

  await c.env.DB.prepare('DELETE FROM playlists WHERE id = ?').bind(id).run();
  return c.json({
    success: true,
    deletedPlaylistId: id,
  });
});

// POST /api/v1/playlists/:id/tracks
playlistsRouter.post('/:id/tracks', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const playlistId = sanitizeText(c.req.param('id'), 'id', 64, false);
  const body = (await c.req.json().catch(() => ({}))) as {
    trackId?: string;
    track?: Track;
  };

  const plRow = await c.env.DB.prepare(
    'SELECT id, user_id, track_count, version FROM playlists WHERE id = ?'
  )
    .bind(playlistId)
    .first<{ id: string; user_id: string; track_count: number; version: number }>();

  if (!plRow) {
    throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
  }
  if (plRow.user_id !== user.id) {
    throw new ApiError(403, 'NOT_PLAYLIST_OWNER', 'Only the playlist owner can add tracks.');
  }

  const trackId = sanitizeText(body.trackId || body.track?.id, 'trackId', 120, false);

  // Idempotent check
  const existingTrack = await c.env.DB.prepare(
    'SELECT id, position, track_json, added_at FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?'
  )
    .bind(playlistId, trackId)
    .first<{ id: string; position: number; track_json: string; added_at: string }>();

  if (existingTrack) {
    return c.json({
      playlistId,
      entryId: existingTrack.id,
      trackId,
      position: existingTrack.position,
      track: JSON.parse(existingTrack.track_json) as Track,
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

  const entryId = generateId('plt');
  const nextPosition = plRow.track_count;
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO playlist_tracks (
      id, playlist_id, track_id, provider, position, title,
      artist_id, artist_name, duration_ms, artwork_url,
      access_state, track_json, added_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      entryId,
      playlistId,
      track.id,
      track.provider,
      nextPosition,
      track.title,
      track.artistId,
      track.artistName,
      track.durationMs,
      track.artworkUrl,
      track.accessState,
      JSON.stringify(track),
      now
    )
    .run();

  await c.env.DB.prepare(
    `UPDATE playlists
     SET track_count = track_count + 1,
         cover_url = COALESCE(cover_url, ?),
         version = version + 1,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(track.artworkUrl, now, playlistId)
    .run();

  return c.json(
    {
      playlistId,
      entryId,
      trackId: track.id,
      position: nextPosition,
      track,
      idempotentReplay: false,
    },
    201
  );
});

// DELETE /api/v1/playlists/:id/tracks/:trackId
playlistsRouter.delete('/:id/tracks/:trackId', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const playlistId = sanitizeText(c.req.param('id'), 'id', 64, false);
  const trackId = sanitizeText(c.req.param('trackId'), 'trackId', 120, false);

  const plRow = await c.env.DB.prepare('SELECT id, user_id FROM playlists WHERE id = ?')
    .bind(playlistId)
    .first<{ id: string; user_id: string }>();

  if (!plRow) {
    throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
  }
  if (plRow.user_id !== user.id) {
    throw new ApiError(403, 'NOT_PLAYLIST_OWNER', 'Only the playlist owner can remove tracks.');
  }

  const delRes = await c.env.DB.prepare(
    'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?'
  )
    .bind(playlistId, trackId)
    .run();

  if ((delRes.meta.changes || 0) > 0) {
    await c.env.DB.prepare(
      `UPDATE playlists
       SET track_count = MAX(0, (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?)),
           version = version + 1,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(playlistId, nowIso(), playlistId)
      .run();
  }

  return c.json({
    success: true,
    playlistId,
    removedTrackId: trackId,
  });
});

// POST /api/v1/playlists/:id/share
playlistsRouter.post('/:id/share', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const playlistId = sanitizeText(c.req.param('id'), 'id', 64, false);

  const plRow = await c.env.DB.prepare('SELECT id, user_id FROM playlists WHERE id = ?')
    .bind(playlistId)
    .first<{ id: string; user_id: string }>();

  if (!plRow) {
    throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
  }
  if (plRow.user_id !== user.id) {
    throw new ApiError(403, 'NOT_PLAYLIST_OWNER', 'Only the playlist owner can share this playlist.');
  }

  const existingShare = await c.env.DB.prepare(
    'SELECT share_id FROM public_shares WHERE playlist_id = ? AND is_active = 1'
  )
    .bind(playlistId)
    .first<{ share_id: string }>();

  const now = nowIso();
  let shareId = existingShare?.share_id;

  if (!shareId) {
    shareId = generateShareToken(10);
    await c.env.DB.prepare(
      `INSERT INTO public_shares (
        share_id, playlist_id, owner_user_id, access_count, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, 0, 1, ?, ?)`
    )
      .bind(shareId, playlistId, user.id, now, now)
      .run();
  }

  await c.env.DB.prepare(
    'UPDATE playlists SET is_public = 1, version = version + 1, updated_at = ? WHERE id = ?'
  )
    .bind(now, playlistId)
    .run();

  return c.json({
    playlistId,
    shareId,
    publicApiUrl: `/api/v1/playlists/public/${shareId}`,
  });
});
