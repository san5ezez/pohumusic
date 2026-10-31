// ============================================================================
// POHUMUSIC — SECURITY HEADERS, REQUEST CONTEXT & CORS MIDDLEWARE
// ============================================================================

import type { Next } from 'hono';
import { generateId } from '../utils/id';
import type { AppContext } from './auth';

export async function securityContextMiddleware(c: AppContext, next: Next): Promise<Response | void> {
  const reqId = c.req.header('X-Request-Id') || generateId('req');
  const clientIp =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '127.0.0.1';

  c.set('requestId', reqId);
  c.set('clientIp', clientIp);

  // Set strict security headers
  c.header('X-Request-Id', reqId);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Dynamic CORS handling
  const origin = c.req.header('Origin');
  const allowedList = (c.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://pohumusic.workers.dev')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origin) {
    if (allowedList.includes('*') || allowedList.includes(origin) || origin.endsWith('.run.app')) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
    }
  } else {
    c.header('Access-Control-Allow-Origin', allowedList[0] || '*');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Device-Id, X-Device-Name, Idempotency-Key, X-Request-Id'
  );
  c.header('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
}
