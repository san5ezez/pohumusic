// ============================================================================
// POHUMUSIC — LOCAL FULL-STACK DEV & PRODUCTION SERVER (server.ts)
// ============================================================================
// Mounts the exact Cloudflare Workers Hono application (`workers/src/app.ts`)
// backed by our SQLite-powered Cloudflare D1 & KV runtime adapter so that
// all `/api/v1/*` routes execute live against real SQL migrations and triggers
// on port 3000 alongside the Vite React frontend.
// ============================================================================

import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import workerEntry from './workers/src/index';
import type { Env, ExecutionContext } from './workers/src/config';
import { applyMigrations, LocalD1Database, LocalKVNamespace } from './workers/src/db/d1-adapter';
import { seedInitialD1Data } from './workers/src/db/seed';

async function startServer() {
  const expressApp = express();
  const PORT = 3000;

  // Initialize persistent in-memory/SQLite D1 database and apply 0001_initial_schema.sql
  const d1 = new LocalD1Database(':memory:');
  const kv = new LocalKVNamespace();

  const workerEnv: Env = {
    DB: d1,
    KV: kv,
    ENVIRONMENT: process.env.NODE_ENV || 'development',
    APP_URL: process.env.APP_URL || `http://localhost:${PORT}`,
    ALLOWED_ORIGINS: '*',
    JWT_ACCESS_SECRET:
      process.env.JWT_ACCESS_SECRET || 'pohumusic-dev-access-secret-key-minimum-32-bytes-2026',
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET || 'pohumusic-dev-refresh-secret-key-minimum-32-bytes-2026',
    PASSWORD_PEPPER: process.env.PASSWORD_PEPPER || 'pohumusic-pepper-2026',
    SOUNDCLOUD_CLIENT_ID: process.env.SOUNDCLOUD_CLIENT_ID || '',
    SOUNDCLOUD_CLIENT_SECRET: process.env.SOUNDCLOUD_CLIENT_SECRET || '',
    SOUNDCLOUD_API_BASE_URL: process.env.SOUNDCLOUD_API_BASE_URL || 'https://api.soundcloud.com',
    SOUNDCLOUD_TOKEN_URL:
      process.env.SOUNDCLOUD_TOKEN_URL || 'https://secure.soundcloud.com/oauth/token',
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
    YOUTUBE_DAILY_QUOTA_LIMIT: process.env.YOUTUBE_DAILY_QUOTA_LIMIT || '10000',
    GOOGLE_CLIENT_ID:
      process.env.GOOGLE_CLIENT_ID ||
      '750365132799-2fg0f63sar4aqqppnru3l7e4e2d8cnrg.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET:
      process.env.GOOGLE_CLIENT_SECRET || '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',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1365970971511357440',
    DISCORD_CLIENT_SECRET:
      process.env.DISCORD_CLIENT_SECRET || 'Ynp4zTqs8Uy-wzyRnG9g3Q--0aJBKWQA',
    SMTP_PROVIDER: process.env.SMTP_PROVIDER || 'resend',
    SMTP_API_KEY: process.env.SMTP_API_KEY || 're_GsYvXYrU_KbtQ8QgpYgZpsG2axmuQRmzC',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'onboarding@resend.dev',
  };

  await applyMigrations(d1);
  const demoSession = await seedInitialD1Data(workerEnv);

  const workerCtx: ExecutionContext = {
    waitUntil: (promise) => {
      promise.catch(() => {});
    },
    passThroughOnException: () => {},
  };

  // Endpoint providing pre-seeded demo credentials for instant Workbench session switching
  expressApp.get('/api/v1/demo-session', (_req, res) => {
    res.json({
      adminAccessToken: demoSession.adminAccessToken,
      adminRefreshToken: demoSession.adminRefreshToken,
      listenerAccessToken: demoSession.listenerAccessToken,
      listenerRefreshToken: demoSession.listenerRefreshToken,
      adminUserId: demoSession.adminUserId,
      listenerUserId: demoSession.listenerUserId,
      defaultShareId: demoSession.defaultShareId,
    });
  });

  // Forward all /api/* requests directly to the Cloudflare Workers Hono handler
  expressApp.use('/api', async (req, res) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) {
          headers.set(k, v.join(', '));
        } else if (typeof v === 'string') {
          headers.set(k, v);
        }
      }

      let bodyBuffer: Buffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          bodyBuffer = Buffer.concat(chunks);
        }
      }

      const webRequest = new Request(fullUrl, {
        method: req.method,
        headers,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
      });

      const webResponse = await workerEntry.fetch(webRequest, workerEnv, workerCtx);
      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const arrayBuf = await webResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      res.status(500).json({
        error: {
          code: 'BRIDGE_ERROR',
          message: err instanceof Error ? err.message : 'Internal bridge error',
        },
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, '0.0.0.0', () => {
    console.log(`PohuMusic Cloudflare Workers Backend & Console running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
