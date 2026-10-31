// ============================================================================
// POHUMUSIC — LISTENING HISTORY ROUTES (/api/v1/history/*)
// ============================================================================
// Implements:
// - GET    /history
// - POST   /history
// - DELETE /history
//
// Section 8 & 11 Rules:
// - Stores at most the last 15 UNIQUE tracks per user (`MAX_UNIQUE_HISTORY_TRACKS = 15`).
// - Deduplicates repeated listens by updating `played_at` and incrementing `play_count_for_user`.
// - Stores `raw_provider_play_count` separately from `calculated_sc_halved_display`
//   (`Math.floor(raw / 2)` for SoundCloud tracks).
// ============================================================================

import { Hono } from 'hono';
import { APP_CONSTANTS, type AppVariables, type Env } from '../config';
import { requireAuthMiddleware } from '../middleware/auth';
import { sanitizeText } from '../middleware/validation';
import type { Track } from '../providers/music-provider';
import { computeSoundCloudMetrics } from '../providers/soundcloud';
import { UnifiedMusicService } from '../services/aggregator';
import { generateId, nowIso } from '../utils/id';

export const historyRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/history
historyRouter.get('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const rowsRes = await c.env.DB.prepare(
    `SELECT id, track_id, provider, title, artist_id, artist_name,
            duration_ms, listened_ms, was_skipped, play_count_for_user,
            raw_provider_play_count, calculated_sc_halved_display,
            track_json, played_at, updated_at
     FROM listening_history
     WHERE user_id = ?
     ORDER BY played_at DESC, rowid DESC
     LIMIT ?`
  )
    .bind(user.id, APP_CONSTANTS.MAX_UNIQUE_HISTORY_TRACKS)
    .all<{
      id: string;
      track_id: string;
      provider: 'soundcloud' | 'youtube';
      listened_ms: number;
      was_skipped: number;
      play_count_for_user: number;
      raw_provider_play_count: number;
      calculated_sc_halved_display: number | null;
      track_json: string;
      played_at: string;
    }>();

  const items = rowsRes.results.map((r) => ({
    historyId: r.id,
    trackId: r.track_id,
    provider: r.provider,
    listenedMs: r.listened_ms,
    wasSkipped: r.was_skipped === 1,
    playCountForUser: r.play_count_for_user,
    rawProviderPlayCount: r.raw_provider_play_count,
    calculatedSoundCloudHalvedDisplay: r.calculated_sc_halved_display,
    playedAt: r.played_at,
    track: JSON.parse(r.track_json) as Track,
  }));

  return c.json({
    count: items.length,
    maxUniqueTracksLimit: APP_CONSTANTS.MAX_UNIQUE_HISTORY_TRACKS,
    history: items,
  });
});

// POST /api/v1/history
historyRouter.post('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as {
    trackId?: string;
    track?: Track;
    listenedMs?: number;
    wasSkipped?: boolean;
  };

  const trackId = sanitizeText(body.trackId || body.track?.id, 'trackId', 120, false);

  let track: Track;
  if (body.track && body.track.id === trackId && body.track.title) {
    track = body.track;
  } else {
    const service = new UnifiedMusicService(c.env);
    track = await service.getTrack(trackId);
  }

  const listenedMs = Math.max(0, Math.floor(Number(body.listenedMs ?? track.durationMs) || 0));
  const wasSkipped = Boolean(body.wasSkipped);
  const rawPlayCount = Math.max(0, Number(track.rawPlayCount || 0));
  const scHalvedDisplay =
    track.provider === 'soundcloud'
      ? computeSoundCloudMetrics(rawPlayCount).calculatedHalvedDisplayScore
      : null;

  const now = nowIso();

  const existing = await c.env.DB.prepare(
    'SELECT id, play_count_for_user FROM listening_history WHERE user_id = ? AND track_id = ?'
  )
    .bind(user.id, track.id)
    .first<{ id: string; play_count_for_user: number }>();

  let historyId: string;
  let nextPlayCount = 1;

  if (existing) {
    historyId = existing.id;
    nextPlayCount = (existing.play_count_for_user || 1) + 1;
    await c.env.DB.prepare(
      `UPDATE listening_history
       SET listened_ms = ?,
           was_skipped = ?,
           play_count_for_user = ?,
           raw_provider_play_count = ?,
           calculated_sc_halved_display = ?,
           track_json = ?,
           played_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(
        listenedMs,
        wasSkipped ? 1 : 0,
        nextPlayCount,
        rawPlayCount,
        scHalvedDisplay,
        JSON.stringify(track),
        now,
        now,
        historyId
      )
      .run();
  } else {
    historyId = generateId('hist');
    await c.env.DB.prepare(
      `INSERT INTO listening_history (
        id, user_id, track_id, provider, title, artist_id, artist_name,
        duration_ms, listened_ms, was_skipped, play_count_for_user,
        raw_provider_play_count, calculated_sc_halved_display,
        track_json, played_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
    )
      .bind(
        historyId,
        user.id,
        track.id,
        track.provider,
        track.title,
        track.artistId,
        track.artistName,
        track.durationMs,
        listenedMs,
        wasSkipped ? 1 : 0,
        rawPlayCount,
        scHalvedDisplay,
        JSON.stringify(track),
        now,
        now
      )
      .run();
  }

  // Enforce Section 8 Rule: Keep only the last 15 unique tracks in history per user
  await c.env.DB.prepare(
    `DELETE FROM listening_history
     WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM listening_history
         WHERE user_id = ?
         ORDER BY played_at DESC, rowid DESC
         LIMIT ?
       )`
  )
    .bind(user.id, user.id, APP_CONSTANTS.MAX_UNIQUE_HISTORY_TRACKS)
    .run();

  const remainingCountRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM listening_history WHERE user_id = ?'
  )
    .bind(user.id)
    .first<{ cnt: number }>();

  return c.json({
    historyId,
    trackId: track.id,
    playCountForUser: nextPlayCount,
    rawProviderPlayCount: rawPlayCount,
    calculatedSoundCloudHalvedDisplay: scHalvedDisplay,
    playedAt: now,
    totalUniqueHistoryCount: Number(remainingCountRow?.cnt || 1),
    maxUniqueTracksLimit: APP_CONSTANTS.MAX_UNIQUE_HISTORY_TRACKS,
  });
});

// DELETE /api/v1/history
historyRouter.delete('/', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const res = await c.env.DB.prepare('DELETE FROM listening_history WHERE user_id = ?')
    .bind(user.id)
    .run();

  return c.json({
    success: true,
    clearedEntries: res.meta.changes || 0,
  });
});
