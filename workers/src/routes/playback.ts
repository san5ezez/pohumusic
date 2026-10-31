// ============================================================================
// POHUMUSIC — PLAYER STATE & QUEUE SYNCHRONIZATION ROUTES (/api/v1/player/*)
// ============================================================================
// Implements:
// - GET /player/state
// - PUT /player/state (Optimistic concurrency + single active device speaker enforcement)
// - GET /player/queue
// - PUT /player/queue (Optimistic concurrency + idempotency key support)
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { requireAuthMiddleware } from '../middleware/auth';
import { sanitizeText } from '../middleware/validation';
import type { Track } from '../providers/music-provider';
import {
  checkIdempotencyResponse,
  getPlayerStateForUser,
  storeIdempotencyResponse,
  updatePlayerStateInD1,
} from '../services/sync';
import { ApiError } from '../utils/errors';
import { nowIso } from '../utils/id';

export const playbackRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/player/state
playbackRouter.get('/state', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const deviceId = c.req.query('deviceId') || c.req.header('X-Device-Id') || user.deviceId;
  const stateData = await getPlayerStateForUser(c.env.DB, user.id, deviceId);

  return c.json({
    activeSession: stateData.activeSession,
    devices: stateData.devices,
    multiDevicePolicy:
      'Активным источником звука может быть только одно устройство одновременно. При переключении устройства воспроизведение на остальных устройствах автоматически ставится на паузу.',
  });
});

// PUT /api/v1/player/state
playbackRouter.put('/state', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const deviceId = sanitizeText(
    body.deviceId || c.req.header('X-Device-Id') || user.deviceId,
    'deviceId',
    64,
    false
  );
  const deviceName = sanitizeText(
    body.deviceName || c.req.header('X-Device-Name') || 'Web Client',
    'deviceName',
    64,
    false
  );
  const idempotencyKey =
    (body.idempotencyKey as string | undefined) || c.req.header('Idempotency-Key') || undefined;

  const updated = await updatePlayerStateInD1(c.env.DB, c.env.KV, user.id, {
    deviceId,
    deviceName,
    activateDevice: body.activateDevice !== undefined ? Boolean(body.activateDevice) : undefined,
    currentTrack: (body.currentTrack as Track | null | undefined) ?? undefined,
    positionMs: body.positionMs !== undefined ? Number(body.positionMs) : undefined,
    isPlaying: body.isPlaying !== undefined ? Boolean(body.isPlaying) : undefined,
    volume: body.volume !== undefined ? Number(body.volume) : undefined,
    repeatMode:
      body.repeatMode === 'one' || body.repeatMode === 'all' || body.repeatMode === 'off'
        ? body.repeatMode
        : undefined,
    shuffleEnabled: body.shuffleEnabled !== undefined ? Boolean(body.shuffleEnabled) : undefined,
    expectedVersion:
      body.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined,
    idempotencyKey,
  });

  return c.json(updated);
});

// GET /api/v1/player/queue
playbackRouter.get('/queue', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(
    `SELECT current_index, tracks_json, context_type, context_id, version, updated_at
     FROM playback_queues WHERE user_id = ?`
  )
    .bind(user.id)
    .first<{
      current_index: number;
      tracks_json: string;
      context_type: string;
      context_id: string | null;
      version: number;
      updated_at: string;
    }>();

  if (!row) {
    return c.json({
      queue: {
        userId: user.id,
        currentIndex: 0,
        tracks: [],
        contextType: 'custom',
        contextId: null,
        version: 1,
        updatedAt: nowIso(),
      },
    });
  }

  let tracks: Track[] = [];
  try {
    tracks = JSON.parse(row.tracks_json) as Track[];
  } catch {
    tracks = [];
  }

  return c.json({
    queue: {
      userId: user.id,
      currentIndex: row.current_index,
      tracks,
      contextType: row.context_type,
      contextId: row.context_id,
      version: row.version,
      updatedAt: row.updated_at,
    },
  });
});

// PUT /api/v1/player/queue
playbackRouter.put('/queue', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const idempotencyKey =
    (body.idempotencyKey as string | undefined) || c.req.header('Idempotency-Key') || undefined;

  const cachedReplay = await checkIdempotencyResponse<Record<string, unknown>>(
    c.env.KV,
    'player_queue',
    user.id,
    idempotencyKey
  );
  if (cachedReplay) {
    return c.json({ ...cachedReplay, idempotentReplay: true });
  }

  const tracks = Array.isArray(body.tracks) ? (body.tracks as Track[]).slice(0, 100) : [];
  const currentIndex = Math.max(
    0,
    Math.min(Math.max(0, tracks.length - 1), Math.floor(Number(body.currentIndex ?? 0) || 0))
  );
  const contextTypeRaw = String(body.contextType || 'custom');
  const validContexts = [
    'search',
    'playlist',
    'favorites',
    'recommendation',
    'album',
    'artist',
    'custom',
  ];
  const contextType = validContexts.includes(contextTypeRaw) ? contextTypeRaw : 'custom';
  const contextId = body.contextId ? String(body.contextId) : null;

  const existing = await c.env.DB.prepare(
    'SELECT version, last_idempotency_key FROM playback_queues WHERE user_id = ?'
  )
    .bind(user.id)
    .first<{ version: number; last_idempotency_key: string | null }>();

  if (
    existing &&
    body.expectedVersion !== undefined &&
    Number(body.expectedVersion) !== existing.version
  ) {
    throw new ApiError(
      409,
      'SYNC_VERSION_CONFLICT',
      `Queue version conflict: expected ${body.expectedVersion}, server is at ${existing.version}.`
    );
  }

  const now = nowIso();
  const nextVersion = existing ? existing.version + 1 : 1;

  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO playback_queues (
        user_id, current_index, tracks_json, context_type, context_id,
        last_idempotency_key, version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
      .bind(
        user.id,
        currentIndex,
        JSON.stringify(tracks),
        contextType,
        contextId,
        idempotencyKey ?? null,
        now
      )
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE playback_queues
       SET current_index = ?,
           tracks_json = ?,
           context_type = ?,
           context_id = ?,
           last_idempotency_key = ?,
           version = ?,
           updated_at = ?
       WHERE user_id = ?`
    )
      .bind(
        currentIndex,
        JSON.stringify(tracks),
        contextType,
        contextId,
        idempotencyKey ?? existing.last_idempotency_key,
        nextVersion,
        now,
        user.id
      )
      .run();
  }

  const responsePayload = {
    queue: {
      userId: user.id,
      currentIndex,
      tracks,
      contextType,
      contextId,
      version: nextVersion,
      updatedAt: now,
    },
    idempotentReplay: false,
  };

  await storeIdempotencyResponse(c.env.KV, 'player_queue', user.id, idempotencyKey, responsePayload);
  return c.json(responsePayload);
});
