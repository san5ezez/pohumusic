// ============================================================================
// POHUMUSIC — CLOUDFLARE KV RATE LIMITING & BRUTE-FORCE PROTECTION MIDDLEWARE
// ============================================================================

import type { Next } from 'hono';
import { ApiError, recordAdminLog } from '../utils/errors';
import type { AppContext } from './auth';

export interface RateLimitConfig {
  bucketPrefix: string;
  maxRequests: number;
  windowSeconds: number;
}

export function rateLimitMiddleware(config: RateLimitConfig) {
  return async (c: AppContext, next: Next): Promise<Response | void> => {
    const clientIp = c.get('clientIp') || '127.0.0.1';
    const windowBucket = Math.floor(Date.now() / (config.windowSeconds * 1000));
    const kvKey = `rl:${config.bucketPrefix}:${clientIp}:${windowBucket}`;

    const rawCount = (await c.env.KV.get(kvKey, { type: 'text' })) as string | null;
    const currentCount = rawCount ? parseInt(rawCount, 10) || 0 : 0;

    const remaining = Math.max(0, config.maxRequests - currentCount - 1);
    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Window', `${config.windowSeconds}s`);

    if (currentCount >= config.maxRequests) {
      c.header('Retry-After', String(config.windowSeconds));
      await recordAdminLog(c.env.DB, {
        actorUserId: c.get('user')?.id ?? null,
        category: 'rate_limit',
        severity: 'warn',
        action: `rate_limit_${config.bucketPrefix}`,
        targetType: 'ip',
        targetId: clientIp,
        statusCode: 429,
        message: `Rate limit exceeded on bucket '${config.bucketPrefix}' (${config.maxRequests} req/${config.windowSeconds}s) from ${clientIp}`,
        ipAddress: clientIp,
      });
      throw new ApiError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Too many requests. Limit is ${config.maxRequests} per ${config.windowSeconds} seconds.`
      );
    }

    await c.env.KV.put(kvKey, String(currentCount + 1), {
      expirationTtl: Math.max(60, config.windowSeconds),
    });

    await next();
  };
}
