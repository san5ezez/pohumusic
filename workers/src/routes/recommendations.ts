// ============================================================================
// POHUMUSIC — RECOMMENDATIONS ROUTES (/api/v1/recommendations/*)
// ============================================================================
// Implements:
// - GET  /recommendations
// - GET  /recommendations/modes
// - GET  /recommendations/track/:id
// - POST /recommendations/feedback
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { optionalAuthMiddleware, requireAuthMiddleware } from '../middleware/auth';
import { sanitizeText } from '../middleware/validation';
import { loadUserSignalsFromD1, scoreCandidatesPure } from '../recommendations/engine';
import {
  ACTIVITY_MODES,
  CHARACTER_MODES,
  LANGUAGE_MODES,
  MOOD_MODES,
  normalizeActivityMode,
  normalizeCharacterMode,
  normalizeLanguageMode,
  normalizeMoodMode,
} from '../recommendations/modes';
import { rankSimilarTracksPure } from '../recommendations/similar';
import { UnifiedMusicService } from '../services/aggregator';
import { ApiError } from '../utils/errors';
import { generateId, nowIso } from '../utils/id';

export const recommendationsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/recommendations/modes
recommendationsRouter.get('/modes', (c) => {
  return c.json({
    activities: ACTIVITY_MODES,
    characters: CHARACTER_MODES,
    moods: MOOD_MODES,
    languages: LANGUAGE_MODES,
    policyNote:
      'Алгоритм использует исключительно реальные метаданные источников (теги, жанр, язык, длительность, популярность) и сигналы пользователя в D1 (история, избранное, пропуски, обратная связь) без выдумывания несуществующих акустических параметров.',
  });
});

// GET /api/v1/recommendations
recommendationsRouter.get('/', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');

  let defaultActivity = 'working';
  let defaultCharacter = 'favorite';
  let defaultMood = 'calm';
  let defaultLanguage = 'any';

  if (user) {
    const pref = await c.env.DB.prepare(
      'SELECT preferred_activity, preferred_character, preferred_mood, preferred_language FROM user_preferences WHERE user_id = ?'
    )
      .bind(user.id)
      .first<{
        preferred_activity: string;
        preferred_character: string;
        preferred_mood: string;
        preferred_language: string;
      }>();

    if (pref) {
      defaultActivity = pref.preferred_activity;
      defaultCharacter = pref.preferred_character;
      defaultMood = pref.preferred_mood;
      defaultLanguage = pref.preferred_language;
    }
  }

  const activity = normalizeActivityMode(c.req.query('activity') || defaultActivity);
  const character = normalizeCharacterMode(c.req.query('character') || defaultCharacter);
  const mood = normalizeMoodMode(c.req.query('mood') || defaultMood);
  const language = normalizeLanguageMode(c.req.query('language') || defaultLanguage);

  const service = new UnifiedMusicService(c.env);
  const [candidates, signals] = await Promise.all([
    service.searchTracks('', 'all', { limit: 40 }),
    loadUserSignalsFromD1(c.env.DB, user?.id),
  ]);

  const recommendations = scoreCandidatesPure(candidates, {
    activity,
    character,
    mood,
    language,
    signals,
    limit: 15,
  });

  return c.json({
    appliedModes: {
      activity,
      character,
      mood,
      language,
    },
    personalizedForUserId: user?.id ?? null,
    count: recommendations.length,
    recommendations,
  });
});

// GET /api/v1/recommendations/track/:id (Dedicated Similar Tracks Mechanism)
recommendationsRouter.get('/track/:id', optionalAuthMiddleware, async (c) => {
  const trackId = sanitizeText(c.req.param('id'), 'id', 120, false);
  const service = new UnifiedMusicService(c.env);

  const [seedTrack, allTracks] = await Promise.all([
    service.getTrack(trackId),
    service.searchTracks('', 'all', { limit: 40 }),
  ]);

  const similar = rankSimilarTracksPure(seedTrack, allTracks, 8);

  return c.json({
    seedTrack,
    count: similar.length,
    similarTracks: similar,
  });
});

// POST /api/v1/recommendations/feedback
recommendationsRouter.post('/feedback', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const trackId = sanitizeText(body.trackId, 'trackId', 120, false);
  const providerRaw = String(body.provider || (trackId.startsWith('yt_') ? 'youtube' : 'soundcloud')).toLowerCase();
  const provider = providerRaw === 'youtube' ? 'youtube' : 'soundcloud';
  const feedbackType = String(body.feedbackType || '').toLowerCase();

  const validTypes = ['like', 'dislike', 'skip', 'complete_listen', 'dismiss'];
  if (!validTypes.includes(feedbackType)) {
    throw new ApiError(
      400,
      'INVALID_FEEDBACK_TYPE',
      `feedbackType must be one of: ${validTypes.join(', ')}`
    );
  }

  const feedbackId = generateId('rfb');
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO recommendation_feedback (
      id, user_id, track_id, provider, artist_id, feedback_type,
      activity_mode, character_mode, mood_mode, language_mode,
      reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      feedbackId,
      user.id,
      trackId,
      provider,
      body.artistId ? String(body.artistId) : null,
      feedbackType,
      body.activityMode ? normalizeActivityMode(String(body.activityMode)) : null,
      body.characterMode ? normalizeCharacterMode(String(body.characterMode)) : null,
      body.moodMode ? normalizeMoodMode(String(body.moodMode)) : null,
      body.languageMode ? normalizeLanguageMode(String(body.languageMode)) : null,
      sanitizeText(body.reason, 'reason', 240, true) || null,
      now,
      now
    )
    .run();

  return c.json(
    {
      feedbackId,
      trackId,
      feedbackType,
      recordedAt: now,
    },
    201
  );
});
