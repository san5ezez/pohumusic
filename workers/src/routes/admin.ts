// ============================================================================
// POHUMUSIC — ADMIN & MODERATION ROUTES (/api/v1/admin/*)
// ============================================================================
// Implements:
// - GET   /admin/statistics
// - GET   /admin/users
// - PATCH /admin/users/:id (Blocks changing own role!)
// - GET   /admin/errors
// - GET   /admin/tracks/popular
// - GET   /admin/settings
// - PATCH /admin/settings
// ============================================================================

import { Hono } from 'hono';
import type { AppVariables, Env } from '../config';
import { requireRoleMiddleware } from '../middleware/auth';
import { parsePagination, sanitizeText } from '../middleware/validation';
import { generatePlatformStatistics } from '../services/statistics';
import { ApiError, recordAdminLog } from '../utils/errors';
import { nowIso } from '../utils/id';

export const adminRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Protect all /admin/* endpoints with role-based access control
adminRouter.use('*', requireRoleMiddleware(['admin', 'moderator']));

// GET /api/v1/admin/statistics
adminRouter.get('/statistics', async (c) => {
  const stats = await generatePlatformStatistics(c.env.DB);
  return c.json(stats);
});

// GET /api/v1/admin/users
adminRouter.get('/users', async (c) => {
  const { limit, offset } = parsePagination({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  const roleFilter = c.req.query('role');

  let sql = `SELECT id, email, username, display_name, role, email_verified,
                    is_suspended, username_changed_at, version, created_at, updated_at
             FROM users`;
  const binds: unknown[] = [];

  if (roleFilter && ['user', 'moderator', 'admin'].includes(roleFilter)) {
    sql += ' WHERE role = ?';
    binds.push(roleFilter);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const usersRes = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({
    count: usersRes.results.length,
    users: usersRes.results,
  });
});

// PATCH /api/v1/admin/users/:id
adminRouter.patch('/users/:id', requireRoleMiddleware(['admin']), async (c) => {
  const actor = c.get('user')!;
  const targetUserId = sanitizeText(c.req.param('id'), 'id', 64, false);
  const body = (await c.req.json().catch(() => ({}))) as {
    role?: 'user' | 'moderator' | 'admin';
    isSuspended?: boolean;
  };

  // Section 12: "Не разрешать самостоятельно менять свою роль."
  if (targetUserId === actor.id && body.role !== undefined) {
    await recordAdminLog(c.env.DB, {
      actorUserId: actor.id,
      category: 'security',
      severity: 'warn',
      action: 'admin_self_role_change_blocked',
      targetType: 'user',
      targetId: actor.id,
      statusCode: 403,
      message: `Admin ${actor.username} attempted to change their own role via PATCH /admin/users/:id`,
      ipAddress: c.get('clientIp'),
    });
    throw new ApiError(
      403,
      'SELF_ROLE_MODIFICATION_FORBIDDEN',
      'Нельзя самостоятельно менять собственную роль даже через панель администратора.'
    );
  }

  const targetUser = await c.env.DB.prepare(
    'SELECT id, username, role, is_suspended, version FROM users WHERE id = ?'
  )
    .bind(targetUserId)
    .first<{
      id: string;
      username: string;
      role: 'user' | 'moderator' | 'admin';
      is_suspended: number;
      version: number;
    }>();

  if (!targetUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Target user not found.');
  }

  const nextRole = body.role ?? targetUser.role;
  if (!['user', 'moderator', 'admin'].includes(nextRole)) {
    throw new ApiError(400, 'INVALID_ROLE', 'Role must be user, moderator, or admin.');
  }

  const nextSuspended =
    body.isSuspended !== undefined ? (body.isSuspended ? 1 : 0) : targetUser.is_suspended;
  const now = nowIso();

  await c.env.DB.prepare(
    `UPDATE users
     SET role = ?, is_suspended = ?, version = version + 1, updated_at = ?
     WHERE id = ?`
  )
    .bind(nextRole, nextSuspended, now, targetUserId)
    .run();

  if (nextSuspended === 1) {
    await c.env.DB.prepare('UPDATE user_sessions SET is_revoked = 1, updated_at = ? WHERE user_id = ?')
      .bind(now, targetUserId)
      .run();
  }

  await recordAdminLog(c.env.DB, {
    actorUserId: actor.id,
    category: 'admin_action',
    severity: 'info',
    action: 'admin_update_user',
    targetType: 'user',
    targetId: targetUserId,
    statusCode: 200,
    message: `Admin ${actor.username} updated user ${targetUser.username}: role=${nextRole}, isSuspended=${nextSuspended === 1}`,
    ipAddress: c.get('clientIp'),
  });

  return c.json({
    user: {
      id: targetUserId,
      username: targetUser.username,
      role: nextRole,
      isSuspended: nextSuspended === 1,
      updatedAt: now,
    },
  });
});

// GET /api/v1/admin/errors
adminRouter.get('/errors', async (c) => {
  const { limit, offset } = parsePagination({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  const category = c.req.query('category');

  let sql = `SELECT id, actor_user_id, category, severity, action, target_type,
                    target_id, provider, status_code, message, metadata_json,
                    ip_address, created_at
             FROM admin_logs`;
  const binds: unknown[] = [];
  if (category) {
    sql += ' WHERE category = ?';
    binds.push(category);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const logsRes = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({
    count: logsRes.results.length,
    logs: logsRes.results,
  });
});

// GET /api/v1/admin/tracks/popular
adminRouter.get('/tracks/popular', async (c) => {
  const stats = await generatePlatformStatistics(c.env.DB);
  return c.json({
    popularTracks: stats.popularTracks,
    soundCloudMetricPolicy: {
      rawField: 'rawProviderPlayCount',
      calculatedField: 'calculatedSoundCloudHalvedDisplayMetric',
      formula: 'floor(rawProviderPlayCount / 2)',
      isOfficialSoundCloudStatistic: false,
      note: 'Оригинальные значения хранятся отдельно от расчётных. Расчётный показатель (деление на 2) не является официальной статистикой SoundCloud.',
    },
  });
});

// GET /api/v1/admin/settings
adminRouter.get('/settings', async (c) => {
  const rowsRes = await c.env.DB.prepare(
    'SELECT key, value_json, description, updated_by, version, updated_at FROM system_settings ORDER BY key ASC'
  ).all<{
    key: string;
    value_json: string;
    description: string;
    updated_by: string | null;
    version: number;
    updated_at: string;
  }>();

  const settings = rowsRes.results.map((r) => {
    let parsedValue: unknown = r.value_json;
    try {
      parsedValue = JSON.parse(r.value_json);
    } catch {
      parsedValue = r.value_json;
    }
    return {
      key: r.key,
      value: parsedValue,
      description: r.description,
      updatedBy: r.updated_by,
      version: r.version,
      updatedAt: r.updated_at,
    };
  });

  return c.json({ settings });
});

// PATCH /api/v1/admin/settings
adminRouter.patch('/settings', requireRoleMiddleware(['admin']), async (c) => {
  const actor = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as {
    key?: string;
    value?: unknown;
    description?: string;
  };

  const key = sanitizeText(body.key, 'key', 80, false);
  if (body.value === undefined) {
    throw new ApiError(400, 'MISSING_SETTING_VALUE', 'Setting value is required.');
  }

  const now = nowIso();
  const valueJson = JSON.stringify(body.value);
  const existing = await c.env.DB.prepare('SELECT key, version, description FROM system_settings WHERE key = ?')
    .bind(key)
    .first<{ key: string; version: number; description: string }>();

  const nextVersion = existing ? existing.version + 1 : 1;
  const description =
    body.description !== undefined
      ? sanitizeText(body.description, 'description', 240, true)
      : existing?.description || '';

  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO system_settings (key, value_json, description, updated_by, version, updated_at)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
      .bind(key, valueJson, description, actor.id, now)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE system_settings
       SET value_json = ?, description = ?, updated_by = ?, version = ?, updated_at = ?
       WHERE key = ?`
    )
      .bind(valueJson, description, actor.id, nextVersion, now, key)
      .run();
  }

  await recordAdminLog(c.env.DB, {
    actorUserId: actor.id,
    category: 'admin_action',
    severity: 'info',
    action: 'update_system_setting',
    targetType: 'system_setting',
    targetId: key,
    statusCode: 200,
    message: `Admin ${actor.username} updated system setting '${key}'`,
    ipAddress: c.get('clientIp'),
  });

  return c.json({
    setting: {
      key,
      value: body.value,
      description,
      updatedBy: actor.id,
      version: nextVersion,
      updatedAt: now,
    },
  });
});
