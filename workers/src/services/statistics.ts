// ============================================================================
// POHUMUSIC — PLATFORM & PROVIDER STATISTICS SERVICE
// ============================================================================
// Section 11:
// - Computes user, active user, listen, popular track, source/provider, and error
//   statistics from D1.
// - For SoundCloud's separate displayed metric, divides the original raw value
//   by 2 (`Math.floor(raw / 2)`), stores the original value separately from the
//   calculated value, and explicitly labels the calculated value as a derived
//   display indicator rather than official SoundCloud statistics.
// ============================================================================

import type { D1Database } from '../config';
import { computeSoundCloudMetrics, SOUNDCLOUD_CATALOG_SEED } from '../providers/soundcloud';
import { YOUTUBE_CATALOG_SEED } from '../providers/youtube';

export interface PopularTrackStatItem {
  trackId: string;
  title: string;
  artistName: string;
  provider: 'soundcloud' | 'youtube';
  pohuPlatformListens: number;
  rawProviderPlayCount: number;
  /**
   * Separate derived indicator for SoundCloud equal to floor(rawProviderPlayCount / 2).
   * Null for non-SoundCloud tracks. Never presented as official SoundCloud telemetry.
   */
  calculatedSoundCloudHalvedDisplayMetric: number | null;
  metricDisclaimer: string;
}

export interface PlatformStatisticsReport {
  generatedAt: string;
  users: {
    totalUsers: number;
    activeUsersLast30Days: number;
    verifiedUsers: number;
    adminsCount: number;
    moderatorsCount: number;
  };
  listens: {
    totalHistoryRecords: number;
    totalPlatformPlaysAccumulated: number;
    totalFavoritesCount: number;
    totalPlaylistsCount: number;
  };
  sources: {
    soundcloud: {
      catalogTracksCount: number;
      historyTracksCount: number;
      favoritesCount: number;
      rawProviderPlaysTotal: number;
      calculatedHalvedDisplayTotal: number;
      calculatedIndicatorNote: string;
    };
    youtube: {
      catalogTracksCount: number;
      historyTracksCount: number;
      favoritesCount: number;
      rawProviderPlaysTotal: number;
    };
  };
  popularTracks: PopularTrackStatItem[];
  errors: {
    totalErrorsLogged: number;
    providerErrorsCount: number;
    rateLimitEventsCount: number;
    syncConflictsCount: number;
    securityEventsCount: number;
  };
}

export async function generatePlatformStatistics(
  db: D1Database
): Promise<PlatformStatisticsReport> {
  const [
    usersTotalRow,
    activeSessionsRow,
    verifiedUsersRow,
    adminsRow,
    moderatorsRow,
    histSummaryRow,
    favTotalRow,
    playlistsTotalRow,
    scHistRow,
    ytHistRow,
    scFavRow,
    ytFavRow,
    errorBreakdownRes,
    popularTracksRes,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>(),
    db
      .prepare('SELECT COUNT(DISTINCT user_id) as cnt FROM user_sessions WHERE is_revoked = 0')
      .first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) as cnt FROM users WHERE email_verified = 1').first<{ cnt: number }>(),
    db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").first<{ cnt: number }>(),
    db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'moderator'").first<{ cnt: number }>(),
    db
      .prepare(
        'SELECT COUNT(*) as records, COALESCE(SUM(play_count_for_user), 0) as total_plays FROM listening_history'
      )
      .first<{ records: number; total_plays: number }>(),
    db.prepare('SELECT COUNT(*) as cnt FROM favorites').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) as cnt FROM playlists').first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) as cnt,
                COALESCE(SUM(raw_provider_play_count), 0) as raw_sum,
                COALESCE(SUM(calculated_sc_halved_display), 0) as halved_sum
         FROM listening_history WHERE provider = 'soundcloud'`
      )
      .first<{ cnt: number; raw_sum: number; halved_sum: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) as cnt,
                COALESCE(SUM(raw_provider_play_count), 0) as raw_sum
         FROM listening_history WHERE provider = 'youtube'`
      )
      .first<{ cnt: number; raw_sum: number }>(),
    db
      .prepare("SELECT COUNT(*) as cnt FROM favorites WHERE provider = 'soundcloud'")
      .first<{ cnt: number }>(),
    db
      .prepare("SELECT COUNT(*) as cnt FROM favorites WHERE provider = 'youtube'")
      .first<{ cnt: number }>(),
    db
      .prepare('SELECT category, severity, COUNT(*) as cnt FROM admin_logs GROUP BY category, severity')
      .all<{ category: string; severity: string; cnt: number }>(),
    db
      .prepare(
        `SELECT track_id, title, artist_name, provider,
                SUM(play_count_for_user) as platform_listens,
                MAX(raw_provider_play_count) as raw_provider_plays,
                MAX(calculated_sc_halved_display) as sc_halved_display
         FROM listening_history
         GROUP BY track_id, title, artist_name, provider
         ORDER BY platform_listens DESC, raw_provider_plays DESC
         LIMIT 10`
      )
      .all<{
        track_id: string;
        title: string;
        artist_name: string;
        provider: 'soundcloud' | 'youtube';
        platform_listens: number;
        raw_provider_plays: number;
        sc_halved_display: number | null;
      }>(),
  ]);

  let totalErrorsLogged = 0;
  let providerErrorsCount = 0;
  let rateLimitEventsCount = 0;
  let syncConflictsCount = 0;
  let securityEventsCount = 0;

  for (const row of errorBreakdownRes.results) {
    if (row.severity === 'error' || row.severity === 'critical' || row.category === 'provider_error') {
      totalErrorsLogged += Number(row.cnt || 0);
    }
    if (row.category === 'provider_error') providerErrorsCount += Number(row.cnt || 0);
    if (row.category === 'rate_limit') rateLimitEventsCount += Number(row.cnt || 0);
    if (row.category === 'sync_conflict') syncConflictsCount += Number(row.cnt || 0);
    if (row.category === 'security') securityEventsCount += Number(row.cnt || 0);
  }

  const popularTracks: PopularTrackStatItem[] = popularTracksRes.results.map((r) => {
    const rawCount = Number(r.raw_provider_plays || 0);
    const scMetrics = r.provider === 'soundcloud' ? computeSoundCloudMetrics(rawCount) : null;
    return {
      trackId: r.track_id,
      title: r.title,
      artistName: r.artist_name,
      provider: r.provider,
      pohuPlatformListens: Number(r.platform_listens || 0),
      rawProviderPlayCount: rawCount,
      calculatedSoundCloudHalvedDisplayMetric:
        r.provider === 'soundcloud'
          ? r.sc_halved_display ?? scMetrics!.calculatedHalvedDisplayScore
          : null,
      metricDisclaimer:
        r.provider === 'soundcloud'
          ? 'Оригинальное значение SoundCloud хранится отдельно от расчётного показателя (raw / 2). Расчётный показатель не является официальной статистикой SoundCloud.'
          : 'Оригинальное количество просмотров YouTube Data API.',
    };
  });

  const scCatalogRawTotal = SOUNDCLOUD_CATALOG_SEED.reduce(
    (acc, t) => acc + Number(t.playback_count || 0),
    0
  );
  const scRawTotal = Math.max(Number(scHistRow?.raw_sum || 0), scCatalogRawTotal);
  const scHalvedTotal = Math.floor(scRawTotal / 2);

  const ytCatalogRawTotal = YOUTUBE_CATALOG_SEED.reduce(
    (acc, v) => acc + parseInt(v.statistics?.viewCount || '0', 10),
    0
  );
  const ytRawTotal = Math.max(Number(ytHistRow?.raw_sum || 0), ytCatalogRawTotal);

  return {
    generatedAt: new Date().toISOString(),
    users: {
      totalUsers: Number(usersTotalRow?.cnt || 0),
      activeUsersLast30Days: Number(activeSessionsRow?.cnt || 0),
      verifiedUsers: Number(verifiedUsersRow?.cnt || 0),
      adminsCount: Number(adminsRow?.cnt || 0),
      moderatorsCount: Number(moderatorsRow?.cnt || 0),
    },
    listens: {
      totalHistoryRecords: Number(histSummaryRow?.records || 0),
      totalPlatformPlaysAccumulated: Number(histSummaryRow?.total_plays || 0),
      totalFavoritesCount: Number(favTotalRow?.cnt || 0),
      totalPlaylistsCount: Number(playlistsTotalRow?.cnt || 0),
    },
    sources: {
      soundcloud: {
        catalogTracksCount: SOUNDCLOUD_CATALOG_SEED.length,
        historyTracksCount: Number(scHistRow?.cnt || 0),
        favoritesCount: Number(scFavRow?.cnt || 0),
        rawProviderPlaysTotal: scRawTotal,
        calculatedHalvedDisplayTotal: scHalvedTotal,
        calculatedIndicatorNote:
          'Расчётный отображаемый показатель (исходное значение / 2) вычисляется отдельно и не является официальной статистикой SoundCloud.',
      },
      youtube: {
        catalogTracksCount: YOUTUBE_CATALOG_SEED.length,
        historyTracksCount: Number(ytHistRow?.cnt || 0),
        favoritesCount: Number(ytFavRow?.cnt || 0),
        rawProviderPlaysTotal: ytRawTotal,
      },
    },
    popularTracks,
    errors: {
      totalErrorsLogged,
      providerErrorsCount,
      rateLimitEventsCount,
      syncConflictsCount,
      securityEventsCount,
    },
  };
}
