// ============================================================================
// POHUMUSIC — AUTHENTICATION & ROLE-BASED ACCESS CONTROL MIDDLEWARE
// ============================================================================

import type { Context, Next } from 'hono';
import { getJwtAccessSecret, type AppVariables, type Env } from '../config';
import { verifyJwt } from '../utils/crypto';
import { ApiError, recordAdminLog } from '../utils/errors';

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

function extractBearerToken(c: AppContext): string | null {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

export async function optionalAuthMiddleware(c: AppContext, next: Next): Promise<Response | void> {
  const token = extractBearerToken(c);
  if (token) {
    const payload = await verifyJwt(token, getJwtAccessSecret(c.env));
    if (payload && payload.type === 'access') {
      const sessionRow = await c.env.DB.prepare(
        `SELECT s.id, s.is_revoked, u.id as user_id, u.email, u.username,
                u.display_name, u.role, u.is_suspended
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.user_id = ?`
      )
        .bind(payload.sid, payload.sub)
        .first<{
          id: string;
          is_revoked: number;
          user_id: string;
          email: string;
          username: string;
          display_name: string;
          role: 'user' | 'moderator' | 'admin';
          is_suspended: number;
        }>();

      if (sessionRow && sessionRow.is_revoked === 0 && sessionRow.is_suspended === 0) {
        c.set('user', {
          id: sessionRow.user_id,
          email: sessionRow.email,
          username: sessionRow.username,
          displayName: sessionRow.display_name,
          role: sessionRow.role,
          sessionId: sessionRow.id,
          deviceId: payload.did,
        });
      }
    }
  }
  await next();
}

export async function requireAuthMiddleware(c: AppContext, next: Next): Promise<Response | void> {
  await optionalAuthMiddleware(c, async () => {});
  const user = c.get('user');
  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required. Provide a valid Bearer access token.');
  }
  await next();
}

export function requireRoleMiddleware(allowedRoles: Array<'user' | 'moderator' | 'admin'>) {
  return async (c: AppContext, next: Next): Promise<Response | void> => {
    await optionalAuthMiddleware(c, async () => {});
    const user = c.get('user');
    if (!user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    if (!allowedRoles.includes(user.role)) {
      await recordAdminLog(c.env.DB, {
        actorUserId: user.id,
        category: 'security',
        severity: 'warn',
        action: 'forbidden_role_access',
        targetType: 'route',
        targetId: c.req.path,
        statusCode: 403,
        message: `User ${user.username} (${user.role}) attempted to access role-restricted route ${c.req.path}`,
        ipAddress: c.get('clientIp'),
      });
      throw new ApiError(
        403,
        'FORBIDDEN_ROLE',
        `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`
      );
    }
    await next();
  };
}
