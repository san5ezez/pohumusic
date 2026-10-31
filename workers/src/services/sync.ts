// ============================================================================
// POHUMUSIC — D1 SYNCHRONIZATION, OPTIMISTIC CONCURRENCY & ACTIVE DEVICE ENGINE
// ============================================================================
// Section 9:
// - D1 is the single source of truth.
// - Enforces record versioning (`version`), `updated_at`, idempotency keys,
//   duplicate operation protection, sync conflict detection (409 Conflict),
//   and single-active-device playback enforcement (switching active device
//   automatically pauses playback on all other devices of the same user).
// ============================================================================

import type { D1Database, KVNamespace } from '../config';
import type { Track } from '../providers/music-provider';
import { ApiError, recordAdminLog } from '../utils/errors';
import { generateId, nowIso } from '../utils/id';

export interface PlayerStatePayload {
  deviceId: string;
  deviceName?: string;
  activateDevice?: boolean;
  currentTrack?: Track | null;
  positionMs?: number;
  isPlaying?: boolean;
  volume?: number;
  repeatMode?: 'off' | 'one' | 'all';
  shuffleEnabled?: boolean;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface PlayerStateRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  isActiveDevice: boolean;
  currentTrackId: string | null;
  currentTrack: Track | null;
  positionMs: number;
  isPlaying: boolean;
  volume: number;
  repeatMode: 'off' | 'one' | 'all';
  shuffleEnabled: boolean;
  version: number;
  updatedAt: string;
  idempotentReplay: boolean;
}

export interface PlaybackQueuePayload {
  currentIndex: number;
  tracks: Track[];
  contextType?: 'search' | 'playlist' | 'favorites' | 'recommendation' | 'album' | 'artist' | 'custom';
  contextId?: string | null;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export async function checkIdempotencyResponse<T>(
  kv: KVNamespace,
  scope: string,
  userId: string,
  idempotencyKey?: string | null
): Promise<T | null> {
  if (!idempotencyKey) return null;
  const key = `idem:${scope}:${userId}:${idempotencyKey}`;
  const cached = await kv.get(key, { type: 'json' });
  return (cached as T) ?? null;
}

export async function storeIdempotencyResponse<T>(
  kv: KVNamespace,
  scope: string,
  userId: string,
  idempotencyKey: string | undefined | null,
  payload: T
): Promise<void> {
  if (!idempotencyKey) return;
  const key = `idem:${scope}:${userId}:${idempotencyKey}`;
  await kv.put(key, JSON.stringify(payload), { expirationTtl: 600 });
}

export async function getPlayerStateForUser(
  db: D1Database,
  userId: string,
  preferredDeviceId?: string
): Promise<{
  activeSession: PlayerStateRecord | null;
  devices: PlayerStateRecord[];
}> {
  const rowsRes = await db
    .prepare(
      `SELECT id, user_id, device_id, device_name, is_active_device, current_track_id,
              current_track_json, position_ms, is_playing, volume, repeat_mode,
              shuffle_enabled, version, updated_at
       FROM playback_sessions
       WHERE user_id = ?
       ORDER BY is_active_device DESC, updated_at DESC`
    )
    .bind(userId)
    .all<{
      id: string;
      user_id: string;
      device_id: string;
      device_name: string;
      is_active_device: number;
      current_track_id: string | null;
      current_track_json: string | null;
      position_ms: number;
      is_playing: number;
      volume: number;
      repeat_mode: 'off' | 'one' | 'all';
      shuffle_enabled: number;
      version: number;
      updated_at: string;
    }>();

  const devices: PlayerStateRecord[] = rowsRes.results.map((r) => {
    let parsedTrack: Track | null = null;
    if (r.current_track_json) {
      try {
        parsedTrack = JSON.parse(r.current_track_json) as Track;
      } catch {
        parsedTrack = null;
      }
    }
    return {
      id: r.id,
      userId: r.user_id,
      deviceId: r.device_id,
      deviceName: r.device_name,
      isActiveDevice: r.is_active_device === 1,
      currentTrackId: r.current_track_id,
      currentTrack: parsedTrack,
      positionMs: r.position_ms,
      isPlaying: r.is_playing === 1,
      volume: r.volume,
      repeatMode: r.repeat_mode,
      shuffleEnabled: r.shuffle_enabled === 1,
      version: r.version,
      updatedAt: r.updated_at,
      idempotentReplay: false,
    };
  });

  const activeSession =
    devices.find((d) => d.isActiveDevice) ||
    (preferredDeviceId ? devices.find((d) => d.deviceId === preferredDeviceId) : null) ||
    devices[0] ||
    null;

  return { activeSession, devices };
}

/**
 * Updates player state in D1 with optimistic locking (`expectedVersion`),
 * idempotency protection, and single-active-speaker synchronization:
 * when a device starts playing or activates, all other devices for that user
 * are automatically set to `is_active_device = 0, is_playing = 0`.
 */
export async function updatePlayerStateInD1(
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  payload: PlayerStatePayload
): Promise<{
  state: PlayerStateRecord;
  devices: PlayerStateRecord[];
  deactivatedOtherDevices: boolean;
}> {
  const cachedReplay = await checkIdempotencyResponse<{
    state: PlayerStateRecord;
    devices: PlayerStateRecord[];
    deactivatedOtherDevices: boolean;
  }>(kv, 'player_state', userId, payload.idempotencyKey);

  if (cachedReplay) {
    return {
      ...cachedReplay,
      state: { ...cachedReplay.state, idempotentReplay: true },
    };
  }

  const existing = await db
    .prepare(
      `SELECT id, version, last_idempotency_key, is_active_device, current_track_id,
              current_track_json, position_ms, is_playing, volume, repeat_mode,
              shuffle_enabled, device_name, updated_at
       FROM playback_sessions
       WHERE user_id = ? AND device_id = ?`
    )
    .bind(userId, payload.deviceId)
    .first<{
      id: string;
      version: number;
      last_idempotency_key: string | null;
      is_active_device: number;
      current_track_id: string | null;
      current_track_json: string | null;
      position_ms: number;
      is_playing: number;
      volume: number;
      repeat_mode: 'off' | 'one' | 'all';
      shuffle_enabled: number;
      device_name: string;
      updated_at: string;
    }>();

  if (existing && payload.idempotencyKey && existing.last_idempotency_key === payload.idempotencyKey) {
    const current = await getPlayerStateForUser(db, userId, payload.deviceId);
    const matching = current.devices.find((d) => d.deviceId === payload.deviceId)!;
    return {
      state: { ...matching, idempotentReplay: true },
      devices: current.devices,
      deactivatedOtherDevices: false,
    };
  }

  if (
    existing &&
    payload.expectedVersion !== undefined &&
    payload.expectedVersion !== existing.version
  ) {
    await recordAdminLog(db, {
      actorUserId: userId,
      category: 'sync_conflict',
      severity: 'warn',
      action: 'player_state_version_conflict',
      targetType: 'playback_session',
      targetId: existing.id,
      statusCode: 409,
      message: `Sync conflict on device ${payload.deviceId}: expected version ${payload.expectedVersion}, server version is ${existing.version}`,
    });

    throw new ApiError(
      409,
      'SYNC_VERSION_CONFLICT',
      `Synchronization conflict: client expected version ${payload.expectedVersion}, but D1 source of truth is at version ${existing.version}.`,
      {
        serverVersion: existing.version,
        serverUpdatedAt: existing.updated_at,
      }
    );
  }

  const shouldBecomeActive =
    payload.activateDevice === true ||
    payload.isPlaying === true ||
    !existing ||
    existing.is_active_device === 1;

  let deactivatedOtherDevices = false;
  const now = nowIso();

  if (shouldBecomeActive) {
    // Enforce single active speaker rule: pause and deactivate all other devices for this user
    const deactivateRes = await db
      .prepare(
        `UPDATE playback_sessions
         SET is_active_device = 0,
             is_playing = 0,
             version = version + 1,
             updated_at = ?
         WHERE user_id = ? AND device_id != ? AND (is_active_device = 1 OR is_playing = 1)`
      )
      .bind(now, userId, payload.deviceId)
      .run();

    deactivatedOtherDevices = (deactivateRes.meta.changes || 0) > 0;
  }

  const nextTrack =
    payload.currentTrack !== undefined
      ? payload.currentTrack
      : existing?.current_track_json
      ? (JSON.parse(existing.current_track_json) as Track)
      : null;

  const nextTrackId = nextTrack ? nextTrack.id : null;
  const nextTrackJson = nextTrack ? JSON.stringify(nextTrack) : null;
  const nextPositionMs = Math.max(0, Math.floor(payload.positionMs ?? existing?.position_ms ?? 0));
  // Only an active device is permitted to have is_playing = 1
  const requestedPlaying = payload.isPlaying ?? (existing ? existing.is_playing === 1 : false);
  const nextIsPlaying = shouldBecomeActive ? requestedPlaying : false;
  const nextVolume = Math.min(1, Math.max(0, payload.volume ?? existing?.volume ?? 0.85));
  const nextRepeatMode = payload.repeatMode ?? existing?.repeat_mode ?? 'off';
  const nextShuffle = payload.shuffleEnabled ?? (existing ? existing.shuffle_enabled === 1 : false);
  const nextDeviceName = (payload.deviceName || existing?.device_name || 'Web Client').trim();

  if (!existing) {
    const newId = generateId('psess');
    await db
      .prepare(
        `INSERT INTO playback_sessions (
          id, user_id, device_id, device_name, is_active_device,
          current_track_id, current_track_json, position_ms, is_playing,
          volume, repeat_mode, shuffle_enabled, last_idempotency_key,
          version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .bind(
        newId,
        userId,
        payload.deviceId,
        nextDeviceName,
        shouldBecomeActive ? 1 : 0,
        nextTrackId,
        nextTrackJson,
        nextPositionMs,
        nextIsPlaying ? 1 : 0,
        nextVolume,
        nextRepeatMode,
        nextShuffle ? 1 : 0,
        payload.idempotencyKey ?? null,
        now
      )
      .run();
  } else {
    const nextVersion = existing.version + 1;
    await db
      .prepare(
        `UPDATE playback_sessions
         SET device_name = ?,
             is_active_device = ?,
             current_track_id = ?,
             current_track_json = ?,
             position_ms = ?,
             is_playing = ?,
             volume = ?,
             repeat_mode = ?,
             shuffle_enabled = ?,
             last_idempotency_key = ?,
             version = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        nextDeviceName,
        shouldBecomeActive ? 1 : 0,
        nextTrackId,
        nextTrackJson,
        nextPositionMs,
        nextIsPlaying ? 1 : 0,
        nextVolume,
        nextRepeatMode,
        nextShuffle ? 1 : 0,
        payload.idempotencyKey ?? existing.last_idempotency_key,
        nextVersion,
        now,
        existing.id
      )
      .run();
  }

  const updated = await getPlayerStateForUser(db, userId, payload.deviceId);
  const targetState =
    updated.devices.find((d) => d.deviceId === payload.deviceId) || updated.activeSession!;

  const result = {
    state: targetState,
    devices: updated.devices,
    deactivatedOtherDevices,
  };

  await storeIdempotencyResponse(kv, 'player_state', userId, payload.idempotencyKey, result);
  return result;
}
