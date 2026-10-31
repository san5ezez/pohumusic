// ============================================================================
// POHUMUSIC — SERVER-SIDE RECOMMENDATION ENGINE
// ============================================================================
// Scores candidate tracks using ONLY verifiable provider metadata (tags,
// genre, language, play_count, accessState) and real D1 user signals:
// - Favorites (`favorites`)
// - Listening History (`listening_history` + `was_skipped`)
// - Favorite Artists (`user_preferences.favorite_artists_json` + favorited artists)
// - Explicit Feedback (`recommendation_feedback`: like, dislike, skip, dismiss)
// Never fabricates synthetic audio analysis parameters when absent from source.
// ============================================================================

import type { D1Database } from '../config';
import type { Track } from '../providers/music-provider';
import {
  ACTIVITY_MODES,
  type ActivityMode,
  type CharacterMode,
  LANGUAGE_MODES,
  type LanguageMode,
  MOOD_MODES,
  type MoodMode,
} from './modes';

export interface UserSignalContext {
  favoriteTrackIds: Set<string>;
  favoriteArtistIds: Set<string>;
  historyTrackIds: Set<string>;
  skippedTrackIds: Set<string>;
  likedTrackIds: Set<string>;
  dislikedTrackIds: Set<string>;
  dismissedTrackIds: Set<string>;
}

export interface ScoredRecommendation {
  track: Track;
  score: number;
  explanationReasons: string[];
  matchedSignals: {
    activityMatch: boolean;
    moodMatch: boolean;
    languageMatch: boolean;
    isFavoriteTrack: boolean;
    isFavoriteArtist: boolean;
    inHistory: boolean;
    penalizedBySkip: boolean;
  };
}

export function scoreCandidatesPure(
  candidates: Track[],
  params: {
    activity: ActivityMode;
    character: CharacterMode;
    mood: MoodMode;
    language: LanguageMode;
    signals: UserSignalContext;
    limit?: number;
  }
): ScoredRecommendation[] {
  const activityDef = ACTIVITY_MODES.find((m) => m.id === params.activity) || ACTIVITY_MODES[2];
  const moodDef = MOOD_MODES.find((m) => m.id === params.mood) || MOOD_MODES[2];
  const langDef = LANGUAGE_MODES.find((m) => m.id === params.language) || LANGUAGE_MODES[2];

  const results: ScoredRecommendation[] = [];

  for (const track of candidates) {
    // Never recommend blocked tracks that cannot be played
    if (track.accessState === 'blocked') {
      continue;
    }

    // Never recommend tracks explicitly disliked or dismissed by the user
    if (
      params.signals.dislikedTrackIds.has(track.id) ||
      params.signals.dismissedTrackIds.has(track.id)
    ) {
      continue;
    }

    // Strict language filter if requested
    let languageMatch = true;
    if (params.language !== 'any') {
      const trackTokens = `${track.title} ${track.tags.join(' ')} ${track.genre || ''}`.toLowerCase();
      const matchesExplicitTag = langDef.matchedProviderTags.some((t) => trackTokens.includes(t));
      languageMatch = track.language === params.language || matchesExplicitTag;
      if (!languageMatch) {
        continue;
      }
    }

    // Strict character filter for 'unfamiliar' (exclude already favorited or listened tracks)
    const isFavoriteTrack = params.signals.favoriteTrackIds.has(track.id);
    const inHistory = params.signals.historyTrackIds.has(track.id);
    const isFavoriteArtist = params.signals.favoriteArtistIds.has(track.artistId);
    const penalizedBySkip = params.signals.skippedTrackIds.has(track.id);

    if (params.character === 'unfamiliar' && (isFavoriteTrack || inHistory)) {
      continue;
    }

    let score = 10;
    const reasons: string[] = [];

    const haystack = `${track.title} ${track.genre || ''} ${track.tags.join(' ')}`.toLowerCase();

    // 1. Activity match based on actual provider tags/genre
    const activityMatch = activityDef.matchedProviderTags.some((kw) => haystack.includes(kw));
    if (activityMatch) {
      score += 25;
      reasons.push(`Теги источника соответствуют режиму «${activityDef.labelRu}»`);
    }

    // 2. Mood match based on actual provider tags/genre
    const moodMatch = moodDef.matchedProviderTags.some((kw) => haystack.includes(kw));
    if (moodMatch) {
      score += 20;
      reasons.push(`Жанр и теги соответствуют настроению «${moodDef.labelRu}»`);
    }

    // 3. Language match
    if (params.language !== 'any' && languageMatch) {
      score += 12;
      reasons.push(`Языковой профиль: ${langDef.labelRu}`);
    }

    // 4. Character mode weighting
    if (params.character === 'favorite') {
      if (isFavoriteTrack) {
        score += 35;
        reasons.push('В вашем списке избранного');
      }
      if (isFavoriteArtist) {
        score += 22;
        reasons.push(`Любимый исполнитель: ${track.artistName}`);
      }
      if (inHistory && !penalizedBySkip) {
        score += 14;
        reasons.push('Прослушано вами ранее без пропусков');
      }
    } else if (params.character === 'unfamiliar') {
      score += 20;
      reasons.push('Новое открытие вне вашей истории прослушиваний');
      if (!isFavoriteArtist) {
        score += 10;
      }
    } else if (params.character === 'popular') {
      const popularityBoost = Math.min(40, Math.round(Math.log10(Math.max(10, track.rawPlayCount)) * 7));
      score += popularityBoost;
      reasons.push(`Высокая популярность в источнике (${track.rawPlayCount.toLocaleString('ru-RU')} прослушиваний)`);
    }

    // 5. Positive feedback boost
    if (params.signals.likedTrackIds.has(track.id)) {
      score += 18;
      reasons.push('Отмечено положительным отзывом');
    }

    // 6. Skip penalty
    if (penalizedBySkip) {
      score -= 30;
      reasons.push('Понижено из-за недавнего пропуска трека');
    }

    // 7. Full playable preference over 30s preview
    if (track.accessState === 'playable') {
      score += 5;
    } else if (track.accessState === 'preview') {
      score -= 5;
      reasons.push('Доступно 30-секундное превью по правилам правообладателя');
    }

    if (reasons.length === 0) {
      reasons.push(`Подборка из каталога ${track.provider.toUpperCase()}`);
    }

    results.push({
      track,
      score,
      explanationReasons: reasons,
      matchedSignals: {
        activityMatch,
        moodMatch,
        languageMatch,
        isFavoriteTrack,
        isFavoriteArtist,
        inHistory,
        penalizedBySkip,
      },
    });
  }

  results.sort((a, b) => b.score - a.score || b.track.rawPlayCount - a.track.rawPlayCount);
  return results.slice(0, params.limit ?? 15);
}

export async function loadUserSignalsFromD1(
  db: D1Database,
  userId?: string
): Promise<UserSignalContext> {
  const empty: UserSignalContext = {
    favoriteTrackIds: new Set(),
    favoriteArtistIds: new Set(),
    historyTrackIds: new Set(),
    skippedTrackIds: new Set(),
    likedTrackIds: new Set(),
    dislikedTrackIds: new Set(),
    dismissedTrackIds: new Set(),
  };

  if (!userId) return empty;

  const [favRes, histRes, fbRes, prefRow] = await Promise.all([
    db
      .prepare('SELECT track_id, artist_id FROM favorites WHERE user_id = ?')
      .bind(userId)
      .all<{ track_id: string; artist_id: string }>(),
    db
      .prepare('SELECT track_id, artist_id, was_skipped FROM listening_history WHERE user_id = ?')
      .bind(userId)
      .all<{ track_id: string; artist_id: string; was_skipped: number }>(),
    db
      .prepare('SELECT track_id, artist_id, feedback_type FROM recommendation_feedback WHERE user_id = ?')
      .bind(userId)
      .all<{ track_id: string; artist_id: string | null; feedback_type: string }>(),
    db
      .prepare('SELECT favorite_artists_json FROM user_preferences WHERE user_id = ?')
      .bind(userId)
      .first<{ favorite_artists_json: string }>(),
  ]);

  for (const row of favRes.results) {
    empty.favoriteTrackIds.add(row.track_id);
    if (row.artist_id) empty.favoriteArtistIds.add(row.artist_id);
  }

  for (const row of histRes.results) {
    empty.historyTrackIds.add(row.track_id);
    if (row.was_skipped === 1) {
      empty.skippedTrackIds.add(row.track_id);
    }
  }

  for (const row of fbRes.results) {
    if (row.feedback_type === 'like' || row.feedback_type === 'complete_listen') {
      empty.likedTrackIds.add(row.track_id);
      if (row.artist_id) empty.favoriteArtistIds.add(row.artist_id);
    } else if (row.feedback_type === 'dislike') {
      empty.dislikedTrackIds.add(row.track_id);
    } else if (row.feedback_type === 'dismiss') {
      empty.dismissedTrackIds.add(row.track_id);
    } else if (row.feedback_type === 'skip') {
      empty.skippedTrackIds.add(row.track_id);
    }
  }

  if (prefRow?.favorite_artists_json) {
    try {
      const parsed = JSON.parse(prefRow.favorite_artists_json) as string[];
      for (const a of parsed) empty.favoriteArtistIds.add(a);
    } catch {
      // ignore malformed JSON
    }
  }

  return empty;
}
