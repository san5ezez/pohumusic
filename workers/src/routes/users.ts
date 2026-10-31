// ============================================================================
// POHUMUSIC — USERS ROUTES (/api/v1/users/*)
// ============================================================================
// Implements:
// - GET    /users/me
// - PATCH  /users/me (7-day nickname cooldown & blocks self-role escalation)
// - DELETE /users/me (Cascading cleanup of all related user data)
// - GET    /users/:username
// - GET    /users/:username/playlists
// ============================================================================

import { Hono } from 'hono';
import { APP_CONSTANTS, type AppVariables, type Env } from '../config';
import { requireAuthMiddleware } from '../middleware/auth';
import { sanitizeText, validateUsername } from '../middleware/validation';
import {
  normalizeActivityMode,
  normalizeCharacterMode,
  normalizeLanguageMode,
  normalizeMoodMode,
} from '../recommendations/modes';
import { ApiError, recordAdminLog } from '../utils/errors';
import { nowIso } from '../utils/id';

export const usersRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/users/me
usersRouter.get('/me', requireAuthMiddleware, async (c) => {
  const authUser = c.get('user')!;
  const [userRow, prefRow, playlistCountRow, favCountRow, histCountRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, email, username, display_name, role, email_verified,
              avatar_url, bio, username_changed_at, version, created_at, updated_at
       FROM users WHERE id = ?`
    )
      .bind(authUser.id)
      .first<{
        id: string;
        email: string;
        username: string;
        display_name: string;
        role: string;
        email_verified: number;
        avatar_url: string | null;
        bio: string | null;
        username_changed_at: string | null;
        version: number;
        created_at: string;
        updated_at: string;
      }>(),
    c.env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(authUser.id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM playlists WHERE user_id = ?')
      .bind(authUser.id)
      .first<{ cnt: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM favorites WHERE user_id = ?')
      .bind(authUser.id)
      .first<{ cnt: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM listening_history WHERE user_id = ?')
      .bind(authUser.id)
      .first<{ cnt: number }>(),
  ]);

  if (!userRow) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User profile not found.');
  }

  let nextUsernameChangeAllowedAt: string | null = null;
  if (userRow.username_changed_at) {
    const unlockMs =
      new Date(userRow.username_changed_at).getTime() +
      APP_CONSTANTS.USERNAME_COOLDOWN_DAYS * 24 * 3600 * 1000;
    if (unlockMs > Date.now()) {
      nextUsernameChangeAllowedAt = new Date(unlockMs).toISOString();
    }
  }

  return c.json({
    user: {
      id: userRow.id,
      email: userRow.email,
      username: userRow.username,
      displayName: userRow.display_name,
      role: userRow.role,
      emailVerified: userRow.email_verified === 1,
      avatarUrl: userRow.avatar_url,
      bio: userRow.bio,
      usernameChangedAt: userRow.username_changed_at,
      nextUsernameChangeAllowedAt,
      version: userRow.version,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    },
    preferences: prefRow,
    quotas: {
      playlistsUsed: Number(playlistCountRow?.cnt || 0),
      playlistsMax: APP_CONSTANTS.MAX_PLAYLISTS_PER_USER,
      favoritesCount: Number(favCountRow?.cnt || 0),
      historyUniqueTracks: Number(histCountRow?.cnt || 0),
      historyMaxUniqueTracks: APP_CONSTANTS.MAX_UNIQUE_HISTORY_TRACKS,
    },
  });
});

// PATCH /api/v1/users/me
usersRouter.patch('/me', requireAuthMiddleware, async (c) => {
  const authUser = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  // Section 12: "Не разрешать самостоятельно менять свою роль."
  if (body.role !== undefined) {
    await recordAdminLog(c.env.DB, {
      actorUserId: authUser.id,
      category: 'security',
      severity: 'warn',
      action: 'self_role_escalation_blocked',
      targetType: 'user',
      targetId: authUser.id,
      statusCode: 403,
      message: `User ${authUser.username} attempted to modify their own role via PATCH /users/me`,
      ipAddress: c.get('clientIp'),
    });
    throw new ApiError(
      403,
      'SELF_ROLE_MODIFICATION_FORBIDDEN',
      'Users are strictly prohibited from modifying their own role.'
    );
  }

  const currentUser = await c.env.DB.prepare(
    'SELECT id, username, display_name, bio, avatar_url, username_changed_at, version FROM users WHERE id = ?'
  )
    .bind(authUser.id)
    .first<{
      id: string;
      username: string;
      display_name: string;
      bio: string | null;
      avatar_url: string | null;
      username_changed_at: string | null;
      version: number;
    }>();

  if (!currentUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  if (
    body.expectedVersion !== undefined &&
    Number(body.expectedVersion) !== currentUser.version
  ) {
    throw new ApiError(
      409,
      'SYNC_VERSION_CONFLICT',
      `Profile version conflict: expected ${body.expectedVersion}, server is at ${currentUser.version}.`
    );
  }

  let nextUsername = currentUser.username;
  let nextUsernameChangedAt = currentUser.username_changed_at;
  const now = nowIso();

  if (body.username !== undefined) {
    const requestedUsername = validateUsername(body.username);
    if (requestedUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
      // Section 8: "Никнейм можно менять раз в 7 дней."
      if (currentUser.username_changed_at) {
        const lastChangedMs = new Date(currentUser.username_changed_at).getTime();
        const cooldownMs = APP_CONSTANTS.USERNAME_COOLDOWN_DAYS * 24 * 3600 * 1000;
        const nextAllowedMs = lastChangedMs + cooldownMs;
        if (Date.now() < nextAllowedMs) {
          const nextAllowedIso = new Date(nextAllowedMs).toISOString();
          throw new ApiError(
            429,
            'USERNAME_CHANGE_COOLDOWN',
            `Никнейм можно менять не чаще одного раза в 7 дней. Следующая смена доступна после ${nextAllowedIso}.`,
            { nextAllowedAt: nextAllowedIso }
          );
        }
      }

      const taken = await c.env.DB.prepare(
        'SELECT id FROM users WHERE lower(username) = ? AND id != ?'
      )
        .bind(requestedUsername.toLowerCase(), authUser.id)
        .first<{ id: string }>();

      if (taken) {
        throw new ApiError(409, 'USERNAME_TAKEN', 'This username is already taken.');
      }

      nextUsername = requestedUsername;
      nextUsernameChangedAt = now;
    }
  }

  const nextDisplayName =
    body.displayName !== undefined
      ? sanitizeText(body.displayName, 'displayName', 64, false)
      : currentUser.display_name;
  const nextBio =
    body.bio !== undefined ? sanitizeText(body.bio, 'bio', 280, true) : currentUser.bio || '';
  const nextAvatarUrl =
    body.avatarUrl !== undefined
      ? sanitizeText(body.avatarUrl, 'avatarUrl', 500, true) || null
      : currentUser.avatar_url;

  const nextVersion = currentUser.version + 1;

  await c.env.DB.prepare(
    `UPDATE users
     SET username = ?,
         display_name = ?,
         bio = ?,
         avatar_url = ?,
         username_changed_at = ?,
         version = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      nextUsername,
      nextDisplayName,
      nextBio,
      nextAvatarUrl,
      nextUsernameChangedAt,
      nextVersion,
      now,
      authUser.id
    )
    .run();

  if (body.preferences && typeof body.preferences === 'object') {
    const prefs = body.preferences as Record<string, unknown>;
    await c.env.DB.prepare(
      `UPDATE user_preferences
       SET preferred_activity = ?,
           preferred_character = ?,
           preferred_mood = ?,
           preferred_language = ?,
           version = version + 1,
           updated_at = ?
       WHERE user_id = ?`
    )
      .bind(
        normalizeActivityMode(String(prefs.preferredActivity || 'working')),
        normalizeCharacterMode(String(prefs.preferredCharacter || 'favorite')),
        normalizeMoodMode(String(prefs.preferredMood || 'calm')),
        normalizeLanguageMode(String(prefs.preferredLanguage || 'any')),
        now,
        authUser.id
      )
      .run();
  }

  return c.json({
    user: {
      id: authUser.id,
      username: nextUsername,
      displayName: nextDisplayName,
      bio: nextBio,
      avatarUrl: nextAvatarUrl,
      usernameChangedAt: nextUsernameChangedAt,
      version: nextVersion,
      updatedAt: now,
    },
  });
});

// DELETE /api/v1/users/me
// Section 8: "Удаление аккаунта должно корректно обрабатывать связанные данные."
usersRouter.delete('/me', requireAuthMiddleware, async (c) => {
  const authUser = c.get('user')!;

  await recordAdminLog(c.env.DB, {
    actorUserId: null,
    category: 'security',
    severity: 'info',
    action: 'user_self_account_deletion',
    targetType: 'user',
    targetId: authUser.id,
    statusCode: 200,
    message: `User ${authUser.username} (${authUser.id}) deleted their account and all associated D1 records.`,
    ipAddress: c.get('clientIp'),
  });

  // Foreign keys with ON DELETE CASCADE automatically purge:
  // user_sessions, oauth_accounts, email_verifications, password_resets,
  // user_preferences, favorites, playlists, playlist_tracks, listening_history,
  // playback_sessions, playback_queues, recommendation_feedback, public_shares.
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(authUser.id).run();

  return c.json({
    success: true,
    deletedUserId: authUser.id,
    cascadedTablesCleaned: [
      'users',
      'user_sessions',
      'oauth_accounts',
      'email_verifications',
      'password_resets',
      'user_preferences',
      'favorites',
      'playlists',
      'playlist_tracks',
      'listening_history',
      'playback_sessions',
      'playback_queues',
      'recommendation_feedback',
      'public_shares',
    ],
  });
});

// GET /api/v1/users/:username
usersRouter.get('/:username', async (c) => {
  const username = c.req.param('username').trim();
  const userRow = await c.env.DB.prepare(
    `SELECT id, username, display_name, role, avatar_url, bio, created_at
     FROM users WHERE lower(username) = ? AND is_suspended = 0`
  )
    .bind(username.toLowerCase())
    .first<{
      id: string;
      username: string;
      display_name: string;
      role: string;
      avatar_url: string | null;
      bio: string | null;
      created_at: string;
    }>();

  if (!userRow) {
    throw new ApiError(404, 'USER_NOT_FOUND', `User '${username}' not found.`);
  }

  const publicPlaylistsRes = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, track_count, created_at, updated_at
     FROM playlists
     WHERE user_id = ? AND is_public = 1
     ORDER BY updated_at DESC`
  )
    .bind(userRow.id)
    .all();

  return c.json({
    profile: {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      role: userRow.role,
      avatarUrl: userRow.avatar_url,
      bio: userRow.bio,
      createdAt: userRow.created_at,
    },
    publicPlaylists: publicPlaylistsRes.results,
  });
});

// GET /api/v1/users/:username/playlists
usersRouter.get('/:username/playlists', async (c) => {
  const username = c.req.param('username').trim();
  const userRow = await c.env.DB.prepare(
    'SELECT id, username, display_name FROM users WHERE lower(username) = ?'
  )
    .bind(username.toLowerCase())
    .first<{ id: string; username: string; display_name: string }>();

  if (!userRow) {
    throw new ApiError(404, 'USER_NOT_FOUND', `User '${username}' not found.`);
  }

  const playlistsRes = await c.env.DB.prepare(
    `SELECT id, title, description, is_public, cover_url, track_count, version, created_at, updated_at
     FROM playlists
     WHERE user_id = ? AND is_public = 1
     ORDER BY updated_at DESC`
  )
    .bind(userRow.id)
    .all();

  return c.json({
    owner: {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
    },
    playlists: playlistsRes.results,
  });
});
