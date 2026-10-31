// ============================================================================
// POHUMUSIC — HONO APPLICATION ROUTER (workers/src/app.ts)
// ============================================================================

import { Hono } from 'hono';
import { APP_CONSTANTS, type AppVariables, type Env } from './config';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { securityContextMiddleware } from './middleware/security';
import { SOUNDCLOUD_TS_PACKAGE_AUDIT } from './providers/soundcloud/types';
import { adminRouter } from './routes/admin';
import { albumsRouter } from './routes/albums';
import { artistsRouter } from './routes/artists';
import { authRouter } from './routes/auth';
import { favoritesRouter } from './routes/favorites';
import { historyRouter } from './routes/history';
import { playbackRouter } from './routes/playback';
import { playlistsRouter } from './routes/playlists';
import { recommendationsRouter } from './routes/recommendations';
import { tracksRouter } from './routes/tracks';
import { usersRouter } from './routes/users';
import { ApiError, recordAdminLog } from './utils/errors';
import { buildOpenApiSpec } from './utils/openapi';

export function createPohuMusicApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

  // Global security headers, Request ID, and CORS
  app.use('*', securityContextMiddleware);

  // Global API rate limiter (180 requests / minute per IP)
  const apiRateLimiter = rateLimitMiddleware({
    bucketPrefix: 'api_global',
    maxRequests: 180,
    windowSeconds: 60,
  });
  app.use(`${APP_CONSTANTS.API_PREFIX}/*`, apiRateLimiter);

  // Health & Architecture Inspection Endpoint
  app.get(`${APP_CONSTANTS.API_PREFIX}/health`, async (c) => {
    const tablesRes = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
    ).all<{ name: string }>();

    return c.json({
      status: 'ok',
      service: 'pohumusic-cloudflare-workers-backend',
      runtime: 'Cloudflare Workers + Hono + D1 + KV + Static Assets',
      storagePolicy: {
        d1SourceOfTruth: true,
        kvCacheEnabled: true,
        r2Used: false,
        audioFilesHostedOnServer: false,
      },
      d1TablesCount: tablesRes.results.length,
      d1Tables: tablesRes.results.map((t) => t.name),
      soundCloudPackageAudit: SOUNDCLOUD_TS_PACKAGE_AUDIT,
    });
  });

  // OpenAPI 3.1.0 Specification Endpoint
  app.get(`${APP_CONSTANTS.API_PREFIX}/openapi.json`, (c) => {
    const baseUrl = c.env.APP_URL || 'http://localhost:3000';
    return c.json(buildOpenApiSpec(baseUrl));
  });

  // Mount all Section 6 API v1 route groups
  app.route(`${APP_CONSTANTS.API_PREFIX}/auth`, authRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/users`, usersRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/tracks`, tracksRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/artists`, artistsRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/albums`, albumsRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/library/favorites`, favoritesRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/playlists`, playlistsRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/history`, historyRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/recommendations`, recommendationsRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/player`, playbackRouter);
  app.route(`${APP_CONSTANTS.API_PREFIX}/admin`, adminRouter);

  // Global Error Handler
  app.onError(async (err, c) => {
    const requestId = c.get('requestId') || 'unknown';
    if (err instanceof ApiError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details ?? null,
            requestId,
          },
        },
        err.statusCode as 400 | 401 | 403 | 404 | 409 | 423 | 429 | 500 | 502 | 503
      );
    }

    // Handle SQLite trigger errors (e.g., PLAYLIST_LIMIT_EXCEEDED trigger)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('PLAYLIST_LIMIT_EXCEEDED')) {
      return c.json(
        {
          error: {
            code: 'PLAYLIST_LIMIT_EXCEEDED',
            message: 'Достигнут лимит: максимум 10 плейлистов на пользователя.',
            requestId,
          },
        },
        400
      );
    }

    await recordAdminLog(c.env.DB, {
      actorUserId: c.get('user')?.id ?? null,
      category: 'system',
      severity: 'error',
      action: 'unhandled_api_exception',
      targetType: 'route',
      targetId: c.req.path,
      statusCode: 500,
      message: msg,
      ipAddress: c.get('clientIp'),
    });

    return c.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected server error occurred.',
          requestId,
        },
      },
      500
    );
  });

  return app;
}

export const app = createPohuMusicApp();
export default app;
