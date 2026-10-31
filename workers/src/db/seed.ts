// ============================================================================
// POHUMUSIC — DETERMINISTIC D1 SEEDER FOR LOCAL RUNTIME & VERIFICATION
// ============================================================================

import type { Env } from '../config';
import {
  computeSoundCloudMetrics,
  mapSoundCloudTrackToCanonical,
  SOUNDCLOUD_CATALOG_SEED,
} from '../providers/soundcloud';
import { mapYouTubeVideoToTrack, YOUTUBE_CATALOG_SEED } from '../providers/youtube';
import { hashPassword, sha256Hex, signJwt } from '../utils/crypto';
import { nowIso } from '../utils/id';

export interface SeededDemoSession {
  adminAccessToken: string;
  adminRefreshToken: string;
  listenerAccessToken: string;
  listenerRefreshToken: string;
  adminUserId: string;
  listenerUserId: string;
  defaultShareId: string;
}

export async function seedInitialD1Data(env: Env): Promise<SeededDemoSession> {
  const existingAdmin = await env.DB.prepare(
    "SELECT id FROM users WHERE email = 'admin@pohumusic.dev'"
  ).first<{ id: string }>();

  const now = nowIso();
  const adminUserId = 'usr_admin_pohu_01';
  const modUserId = 'usr_mod_pohu_02';
  const listenerUserId = 'usr_listener_pohu_03';
  const defaultShareId = 'pohuNight26';

  if (!existingAdmin) {
    const passwordHash = await hashPassword('PohuMusic2026!', env.PASSWORD_PEPPER || '');

    // 1. Insert users (admin, moderator, user)
    await env.DB.prepare(
      `INSERT INTO users (
        id, email, username, display_name, password_hash, password_algo,
        role, email_verified, is_suspended, avatar_url, bio, version, created_at, updated_at
      ) VALUES
        (?, 'admin@pohumusic.dev', 'sanchez_admin', 'Alexey Fedorov (Lead Architect)', ?, 'argon2id-v1', 'admin', 1, 0, '/src/assets/images/cover_kinetic_pulse_1793425672073.jpg', 'PohuMusic Cloudflare Workers & D1 Platform Architect', 1, ?, ?),
        (?, 'mod@pohumusic.dev', 'kira_mod', 'Kira Moderator', ?, 'argon2id-v1', 'moderator', 1, 0, '/src/assets/images/cover_northern_echoes_1793425670584.jpg', 'Куратор каталога и модератор плейлистов', 1, ?, ?),
        (?, 'listener@pohumusic.dev', 'nikita_wave', 'Nikita Wave', ?, 'argon2id-v1', 'user', 1, 0, '/src/assets/images/cover_midnight_transit_1793425670755.jpg', 'Любитель ночного пост-панка, модулярного эмбиента и синтвейва', 1, ?, ?)`
    )
      .bind(
        adminUserId,
        passwordHash,
        now,
        now,
        modUserId,
        passwordHash,
        now,
        now,
        listenerUserId,
        passwordHash,
        now,
        now
      )
      .run();

    // 2. Insert user_preferences
    await env.DB.prepare(
      `INSERT INTO user_preferences (
        user_id, preferred_activity, preferred_character, preferred_mood,
        preferred_language, favorite_artists_json, version, updated_at
      ) VALUES
        (?, 'working', 'favorite', 'calm', 'any', '["sc_artist_8001","sc_artist_8002"]', 1, ?),
        (?, 'commuting', 'popular', 'energetic', 'ru', '["sc_artist_8001"]', 1, ?)`
    )
      .bind(adminUserId, now, listenerUserId, now)
      .run();

    // 3. Insert OAuth connected accounts
    await env.DB.prepare(
      `INSERT INTO oauth_accounts (
        id, user_id, provider, provider_account_id, provider_email, provider_username, created_at, updated_at
      ) VALUES
        ('oa_google_01', ?, 'google', 'google_uid_99182', 'admin@pohumusic.dev', 'Alexey Fedorov', ?, ?),
        ('oa_discord_01', ?, 'discord', 'discord_uid_44129', 'admin@pohumusic.dev', 'sanchez#0001', ?, ?)`
    )
      .bind(adminUserId, now, now, adminUserId, now, now)
      .run();

    // 4. Insert initial favorites
    const scTrack1 = mapSoundCloudTrackToCanonical(SOUNDCLOUD_CATALOG_SEED[0]);
    const scTrack2 = mapSoundCloudTrackToCanonical(SOUNDCLOUD_CATALOG_SEED[1]);
    const ytTrack1 = mapYouTubeVideoToTrack(YOUTUBE_CATALOG_SEED[0]);

    for (const [idx, t] of [scTrack1, scTrack2, ytTrack1].entries()) {
      await env.DB.prepare(
        `INSERT INTO favorites (
          id, user_id, track_id, provider, title, artist_id, artist_name,
          album_id, album_title, duration_ms, artwork_url, access_state,
          track_json, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
        .bind(
          `fav_seed_0${idx + 1}`,
          adminUserId,
          t.id,
          t.provider,
          t.title,
          t.artistId,
          t.artistName,
          t.albumId,
          t.albumTitle,
          t.durationMs,
          t.artworkUrl,
          t.accessState,
          JSON.stringify(t),
          now,
          now
        )
        .run();
    }

    // 5. Insert initial playlists & public share
    const playlist1Id = 'pl_night_architecture_01';
    const playlist2Id = 'pl_deep_work_modular_02';

    await env.DB.prepare(
      `INSERT INTO playlists (
        id, user_id, title, description, is_public, cover_url, track_count, version, created_at, updated_at
      ) VALUES
        (?, ?, 'Ночная Архитектура & Холодный Синт', 'Плейлист для ночных поездок и работы над серверной архитектурой.', 1, ?, 3, 1, ?, ?),
        (?, ?, 'Фокус: Модулярные Петли (Без слов)', 'Инструментальная подборка из SoundCloud и YouTube.', 1, ?, 2, 1, ?, ?)`
    )
      .bind(
        playlist1Id,
        adminUserId,
        scTrack1.artworkUrl,
        now,
        now,
        playlist2Id,
        adminUserId,
        scTrack2.artworkUrl,
        now,
        now
      )
      .run();

    const pl1Tracks = [scTrack1, scTrack2, ytTrack1];
    for (let i = 0; i < pl1Tracks.length; i++) {
      const tr = pl1Tracks[i];
      await env.DB.prepare(
        `INSERT INTO playlist_tracks (
          id, playlist_id, track_id, provider, position, title, artist_id,
          artist_name, duration_ms, artwork_url, access_state, track_json, added_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          `plt_seed_1_${i}`,
          playlist1Id,
          tr.id,
          tr.provider,
          i,
          tr.title,
          tr.artistId,
          tr.artistName,
          tr.durationMs,
          tr.artworkUrl,
          tr.accessState,
          JSON.stringify(tr),
          now
        )
        .run();
    }

    await env.DB.prepare(
      `INSERT INTO public_shares (
        share_id, playlist_id, owner_user_id, access_count, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, 14, 1, ?, ?)`
    )
      .bind(defaultShareId, playlist1Id, adminUserId, now, now)
      .run();

    // 6. Insert initial listening history (storing raw play count separately from SoundCloud / 2 metric)
    const histTracks = [
      mapSoundCloudTrackToCanonical(SOUNDCLOUD_CATALOG_SEED[0]),
      mapSoundCloudTrackToCanonical(SOUNDCLOUD_CATALOG_SEED[1]),
      mapSoundCloudTrackToCanonical(SOUNDCLOUD_CATALOG_SEED[2]),
      mapSoundCloudTrackToCanonical(SOUNDCLOUD_CATALOG_SEED[3]),
      mapYouTubeVideoToTrack(YOUTUBE_CATALOG_SEED[0]),
      mapYouTubeVideoToTrack(YOUTUBE_CATALOG_SEED[1]),
    ];

    for (let i = 0; i < histTracks.length; i++) {
      const tr = histTracks[i];
      const scHalved =
        tr.provider === 'soundcloud'
          ? computeSoundCloudMetrics(tr.rawPlayCount).calculatedHalvedDisplayScore
          : null;
      const playedTime = new Date(Date.now() - (histTracks.length - i) * 600000).toISOString();

      await env.DB.prepare(
        `INSERT INTO listening_history (
          id, user_id, track_id, provider, title, artist_id, artist_name,
          duration_ms, listened_ms, was_skipped, play_count_for_user,
          raw_provider_play_count, calculated_sc_halved_display,
          track_json, played_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          `hist_seed_${i + 1}`,
          adminUserId,
          tr.id,
          tr.provider,
          tr.title,
          tr.artistId,
          tr.artistName,
          tr.durationMs,
          tr.durationMs,
          3 - (i % 2),
          tr.rawPlayCount,
          scHalved,
          JSON.stringify(tr),
          playedTime,
          playedTime
        )
        .run();
    }

    // 7. Insert multi-device playback sessions (1 active studio desktop + 1 paused mobile phone)
    await env.DB.prepare(
      `INSERT INTO playback_sessions (
        id, user_id, device_id, device_name, is_active_device,
        current_track_id, current_track_json, position_ms, is_playing,
        volume, repeat_mode, shuffle_enabled, version, updated_at
      ) VALUES
        ('psess_desktop_01', ?, 'dev_studio_mac', 'MacBook Pro — Studio Monitor', 1, ?, ?, 48200, 0, 0.85, 'off', 0, 1, ?),
        ('psess_mobile_02', ?, 'dev_iphone_16', 'iPhone — Mobile App', 0, ?, ?, 12000, 0, 0.70, 'off', 0, 1, ?)`
    )
      .bind(
        adminUserId,
        scTrack1.id,
        JSON.stringify(scTrack1),
        now,
        adminUserId,
        scTrack1.id,
        JSON.stringify(scTrack1),
        now
      )
      .run();

    await env.DB.prepare(
      `INSERT INTO playback_queues (
        user_id, current_index, tracks_json, context_type, context_id, version, updated_at
      ) VALUES (?, 0, ?, 'playlist', ?, 1, ?)`
    )
      .bind(adminUserId, JSON.stringify(pl1Tracks), playlist1Id, now)
      .run();

    // 8. Insert system settings
    await env.DB.prepare(
      `INSERT INTO system_settings (key, value_json, description, updated_by, version, updated_at)
       VALUES
         ('platform.maintenance_mode', 'false', 'Глобальный режим технического обслуживания API', ?, 1, ?),
         ('providers.soundcloud.enabled', 'true', 'Активность провайдера SoundCloud Official API', ?, 1, ?),
         ('providers.youtube.enabled', 'true', 'Активность провайдера YouTube Data API v3 + Official Embed', ?, 1, ?),
         ('quotas.max_playlists_per_user', '10', 'Жёсткий лимит плейлистов на пользователя в D1', ?, 1, ?),
         ('quotas.max_history_unique_tracks', '15', 'Количество уникальных треков в истории пользователя', ?, 1, ?),
         ('security.username_cooldown_days', '7', 'Минимальный интервал смены никнейма в днях', ?, 1, ?)`
    )
      .bind(
        adminUserId,
        now,
        adminUserId,
        now,
        adminUserId,
        now,
        adminUserId,
        now,
        adminUserId,
        now,
        adminUserId,
        now
      )
      .run();

    // 9. Insert initial admin & telemetry logs
    await env.DB.prepare(
      `INSERT INTO admin_logs (
        id, actor_user_id, category, severity, action, target_type, target_id,
        provider, status_code, message, metadata_json, ip_address, created_at
      ) VALUES
        ('log_seed_01', ?, 'system', 'info', 'd1_migrations_verified', 'database', 'pohumusic-db', NULL, 200, 'D1 schema migration 0001_initial_schema.sql applied (16 tables, foreign keys, triggers active).', '{"tables":16,"r2Used":false}', '127.0.0.1', ?),
        ('log_seed_02', ?, 'provider_error', 'warn', 'soundcloud_track_blocked_policy', 'track', 'sc_1901006', 'soundcloud', 403, 'Track sc_1901006 returned access=blocked from SoundCloud API; playback prevented per policy.', '{"access":"blocked"}', '127.0.0.1', ?),
        ('log_seed_03', ?, 'security', 'info', 'argon2id_auth_initialized', 'auth', 'system', NULL, 200, 'Argon2id-v1 password hashing and refresh token rotation family guard active.', '{}', '127.0.0.1', ?)`
    )
      .bind(adminUserId, now, adminUserId, now, adminUserId, now)
      .run();
  }

  // Create or refresh active sessions for admin & listener so demo client can switch or inspect immediately
  const accessSecret = env.JWT_ACCESS_SECRET || 'pohumusic-dev-access-secret-key-minimum-32-bytes-2026';
  const refreshSecret = env.JWT_REFRESH_SECRET || 'pohumusic-dev-refresh-secret-key-minimum-32-bytes-2026';

  const adminSessionId = 'sess_admin_seed_01';
  const listenerSessionId = 'sess_listener_seed_01';

  const adminAccessToken = await signJwt(
    {
      sub: adminUserId,
      email: 'admin@pohumusic.dev',
      username: 'sanchez_admin',
      displayName: 'Alexey Fedorov (Lead Architect)',
      role: 'admin',
      sid: adminSessionId,
      did: 'dev_studio_mac',
      type: 'access',
    },
    accessSecret,
    3600
  );

  const adminRefreshToken = await signJwt(
    {
      sub: adminUserId,
      email: 'admin@pohumusic.dev',
      username: 'sanchez_admin',
      displayName: 'Alexey Fedorov (Lead Architect)',
      role: 'admin',
      sid: adminSessionId,
      did: 'dev_studio_mac',
      fam: 'fam_admin_seed',
      type: 'refresh',
    },
    refreshSecret,
    86400 * 30
  );

  const listenerAccessToken = await signJwt(
    {
      sub: listenerUserId,
      email: 'listener@pohumusic.dev',
      username: 'nikita_wave',
      displayName: 'Nikita Wave',
      role: 'user',
      sid: listenerSessionId,
      did: 'dev_web_listener',
      type: 'access',
    },
    accessSecret,
    3600
  );

  const listenerRefreshToken = await signJwt(
    {
      sub: listenerUserId,
      email: 'listener@pohumusic.dev',
      username: 'nikita_wave',
      displayName: 'Nikita Wave',
      role: 'user',
      sid: listenerSessionId,
      did: 'dev_web_listener',
      fam: 'fam_listener_seed',
      type: 'refresh',
    },
    refreshSecret,
    86400 * 30
  );

  const adminRefreshHash = await sha256Hex(adminRefreshToken);
  const listenerRefreshHash = await sha256Hex(listenerRefreshToken);
  const expiresAt = new Date(Date.now() + 86400 * 30 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT OR REPLACE INTO user_sessions (
      id, user_id, refresh_token_hash, token_family, device_id,
      device_name, device_type, ip_address, user_agent, is_revoked,
      expires_at, last_active_at, created_at, updated_at
    ) VALUES
      (?, ?, ?, 'fam_admin_seed', 'dev_studio_mac', 'MacBook Pro — Studio Monitor', 'desktop', '127.0.0.1', 'PohuMusic-Workbench/1.0', 0, ?, ?, ?, ?),
      (?, ?, ?, 'fam_listener_seed', 'dev_web_listener', 'Web Browser — Chrome', 'web', '127.0.0.1', 'PohuMusic-Workbench/1.0', 0, ?, ?, ?, ?)`
  )
    .bind(
      adminSessionId,
      adminUserId,
      adminRefreshHash,
      expiresAt,
      now,
      now,
      now,
      listenerSessionId,
      listenerUserId,
      listenerRefreshHash,
      expiresAt,
      now,
      now,
      now
    )
    .run();

  return {
    adminAccessToken,
    adminRefreshToken,
    listenerAccessToken,
    listenerRefreshToken,
    adminUserId,
    listenerUserId,
    defaultShareId,
  };
}
