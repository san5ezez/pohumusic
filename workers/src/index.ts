// ============================================================================
// POHUMUSIC — CLOUDFLARE WORKERS ENTRY POINT (workers/src/index.ts)
// ============================================================================
// Routes `/api/v1/*` requests through the Hono backend and serves static
// frontend assets via Cloudflare Workers Static Assets (`env.ASSETS`).
// Strictly uses Cloudflare D1 + KV (never R2, never hosts audio files).
// ============================================================================

import app from './app';
import type { Env, ExecutionContext } from './config';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx as unknown as never);
    }

    // Serve SPA via Workers Static Assets binding when deployed on Cloudflare
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return app.fetch(request, env, ctx as unknown as never);
  },
};
