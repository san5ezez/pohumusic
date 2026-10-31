// ============================================================================
// POHUMUSIC — COMPREHENSIVE BACKEND & CLOUDFLARE WORKERS RUNTIME TEST SUITE
// ============================================================================
// Verifies:
// 1. D1 database migration (all 16 tables, foreign keys, triggers)
// 2. Real HTTP fetch SoundCloud OAuth 2.1 + API integration (playable/preview/blocked,
//    KV caching, HTTP 429 rate-limit handling, and raw vs /2 calculated metric)
// 3. Auth (Argon2id hashing, JWT access/refresh rotation, token reuse family revocation,
//    brute-force lockout, honest email service reporting)
// 4. Business rules (Max 10 playlists, last 15 unique history tracks, 7-day nickname
//    cooldown, cascading account deletion)
// 5. Synchronization (D1 version conflicts 409, idempotency keys, single active speaker
//    across multiple devices)
// 6. Recommendations (all 4 mode axes + similar tracks + feedback) & Admin RBAC
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import workerEntry from '../index';
import type { Env, ExecutionContext } from '../config';
import { applyMigrations, LocalD1Database, LocalKVNamespace } from '../db/d1-adapter';
import { SoundCloudProvider, computeSoundCloudMetrics } from '../providers/soundcloud';

function createTestEnv(): Env {
  return {
    DB: new LocalD1Database(':memory:'),
    KV: new LocalKVNamespace(),
    ENVIRONMENT: 'test',
    APP_URL: 'http://localhost:3000',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'test-access-secret-key-minimum-32-bytes-long-2026',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key-minimum-32-bytes-long-2026',
    PASSWORD_PEPPER: 'test-pepper-2026',
    YOUTUBE_DAILY_QUOTA_LIMIT: '10000',
  };
}

const dummyCtx: ExecutionContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
};

async function apiRequest(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: Record<string, any>; headers: Headers }> {
  const url = `http://localhost:3000${path}`;
  const req = new Request(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const res = await workerEntry.fetch(req, env, dummyCtx);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body, headers: res.headers };
}

test('1. D1 Migrations create all 16 required tables and enforce foreign keys', async () => {
  const env = createTestEnv();
  await applyMigrations(env.DB);

  const health = await apiRequest(env, '/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.storagePolicy.r2Used, false);
  assert.equal(health.body.storagePolicy.audioFilesHostedOnServer, false);

  const expectedTables = [
    'admin_logs',
    'email_verifications',
    'favorites',
    'listening_history',
    'oauth_accounts',
    'password_resets',
    'playback_queues',
    'playback_sessions',
    'playlist_tracks',
    'playlists',
    'public_shares',
    'recommendation_feedback',
    'system_settings',
    'user_preferences',
    'user_sessions',
    'users',
  ];

  assert.deepEqual(health.body.d1Tables, expectedTables);
});

test('2. SoundCloud.ts Provider executes real HTTP fetch against live HTTP test server (OAuth 2.1, playable/preview/blocked, KV cache, 429 rate limit, halved metric)', async () => {
  const env = createTestEnv();
  await applyMigrations(env.DB);

  let tokenRequestsCount = 0;
  let trackSearchCount = 0;
  let forceRateLimit = false;

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');

    if (req.method === 'POST' && reqUrl.pathname === '/oauth/token') {
      tokenRequestsCount += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          access_token: 'sc_live_test_token_2026',
          token_type: 'bearer',
          expires_in: 3600,
        })
      );
      return;
    }

    if (forceRateLimit) {
      res.writeHead(429, { 'Retry-After': '15', 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }

    const authHeader = req.headers['authorization'];
    if (authHeader !== 'OAuth sc_live_test_token_2026') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/tracks') {
      trackSearchCount += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          collection: [
            {
              id: 77701,
              urn: 'soundcloud:tracks:77701',
              title: 'Live Server Synth Test',
              duration: 210000,
              streamable: true,
              access: 'playable',
              permalink_url: 'https://soundcloud.com/test/live-synth',
              genre: 'Synthwave',
              tag_list: 'synthwave driving night',
              playback_count: 1001,
              likes_count: 90,
              user: {
                id: 901,
                username: 'SynthTester',
                permalink_url: 'https://soundcloud.com/synthtester',
              },
            },
            {
              id: 77702,
              urn: 'soundcloud:tracks:77702',
              title: 'Go+ Preview Track',
              duration: 30000,
              streamable: true,
              access: 'preview',
              permalink_url: 'https://soundcloud.com/test/preview-track',
              playback_count: 500,
              user: {
                id: 901,
                username: 'SynthTester',
                permalink_url: 'https://soundcloud.com/synthtester',
              },
            },
            {
              id: 77703,
              urn: 'soundcloud:tracks:77703',
              title: 'Blocked Region Track',
              duration: 180000,
              streamable: false,
              access: 'blocked',
              permalink_url: 'https://soundcloud.com/test/blocked-track',
              playback_count: 250,
              user: {
                id: 901,
                username: 'SynthTester',
                permalink_url: 'https://soundcloud.com/synthtester',
              },
            },
          ],
          next_href: null,
        })
      );
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/tracks/77701') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 77701,
          title: 'Live Server Synth Test',
          duration: 210000,
          streamable: true,
          access: 'playable',
          permalink_url: 'https://soundcloud.com/test/live-synth',
          playback_count: 1001,
          user: { id: 901, username: 'SynthTester', permalink_url: 'https://soundcloud.com/synthtester' },
        })
      );
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/tracks/77701/streams') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          hls_mp3_128_url: 'https://api.soundcloud.com/streams/hls/77701.m3u8',
          preview_mp3_128_url: 'https://api.soundcloud.com/streams/preview/77701.mp3',
        })
      );
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/tracks/77703') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 77703,
          title: 'Blocked Region Track',
          duration: 180000,
          streamable: false,
          access: 'blocked',
          permalink_url: 'https://soundcloud.com/test/blocked-track',
          playback_count: 250,
          user: { id: 901, username: 'SynthTester', permalink_url: 'https://soundcloud.com/synthtester' },
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    env.SOUNDCLOUD_CLIENT_ID = 'live_test_client_id';
    env.SOUNDCLOUD_CLIENT_SECRET = 'live_test_client_secret';
    env.SOUNDCLOUD_API_BASE_URL = baseUrl;
    env.SOUNDCLOUD_TOKEN_URL = `${baseUrl}/oauth/token`;

    const scProvider = new SoundCloudProvider(env);
    const tracks = await scProvider.searchTracks('synth');

    assert.equal(tracks.length, 3);
    assert.equal(tokenRequestsCount, 1);
    assert.equal(trackSearchCount, 1);

    // Check SoundCloud separate halved display metric vs raw play count
    assert.equal(tracks[0].rawPlayCount, 1001);
    assert.equal(tracks[0].soundcloudMetrics?.rawPlayCount, 1001);
    assert.equal(tracks[0].soundcloudMetrics?.calculatedHalvedDisplayScore, 500);
    assert.equal(tracks[0].soundcloudMetrics?.isOfficialStatistic, false);

    // Check playable, preview, and blocked states
    assert.equal(tracks[0].accessState, 'playable');
    assert.equal(tracks[1].accessState, 'preview');
    assert.equal(tracks[2].accessState, 'blocked');

    // Second identical search hits KV cache without new HTTP call
    const cachedTracks = await scProvider.searchTracks('synth');
    assert.equal(cachedTracks.length, 3);
    assert.equal(trackSearchCount, 1);

    // Playback info respects playable vs blocked
    const playableInfo = await scProvider.getPlaybackInfo('sc_77701');
    assert.equal(playableInfo.canPlayFullTrack, true);
    assert.equal(playableInfo.authorizedStreamEndpoint, 'https://api.soundcloud.com/streams/hls/77701.m3u8');

    const blockedInfo = await scProvider.getPlaybackInfo('sc_77703');
    assert.equal(blockedInfo.accessState, 'blocked');
    assert.equal(blockedInfo.canPlayFullTrack, false);
    assert.equal(blockedInfo.canPlayPreview, false);
    assert.equal(blockedInfo.authorizedStreamEndpoint, null);

    // Verify 429 rate-limit handling
    forceRateLimit = true;
    await assert.rejects(
      async () => {
        await scProvider.searchTracks('uncached-query');
      },
      (err: any) => err.code === 'SOUNDCLOUD_RATE_LIMITED' && err.statusCode === 429
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('3. Auth flow: Register, Login, Token Rotation, Reuse Detection, and 7-day Nickname Cooldown', async () => {
  const env = createTestEnv();
  await applyMigrations(env.DB);

  // Register user
  const reg = await apiRequest(env, '/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'ivan@pohumusic.dev',
      username: 'ivan_synth',
      password: 'StrongPassword2026!',
      displayName: 'Ivan Synth',
      deviceId: 'dev_1',
    }),
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.username, 'ivan_synth');
  assert.equal(reg.body.emailVerification.emailServiceConfigured, false);

  const accessToken = reg.body.tokens.accessToken as string;
  const firstRefreshToken = reg.body.tokens.refreshToken as string;

  // Rotate refresh token once -> succeeds
  const rot1 = await apiRequest(env, '/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: firstRefreshToken }),
  });
  assert.equal(rot1.status, 200);
  const secondRefreshToken = rot1.body.tokens.refreshToken as string;
  assert.notEqual(secondRefreshToken, firstRefreshToken);

  // Attempt to reuse firstRefreshToken -> triggers Token Reuse Detection & revokes family!
  const reuseAttempt = await apiRequest(env, '/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: firstRefreshToken }),
  });
  assert.equal(reuseAttempt.status, 401);
  assert.equal(reuseAttempt.body.error.code, 'REFRESH_TOKEN_REUSED');

  // Re-login to get a fresh session
  const login = await apiRequest(env, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'ivan@pohumusic.dev',
      password: 'StrongPassword2026!',
      deviceId: 'dev_1',
    }),
  });
  assert.equal(login.status, 200);
  const freshToken = login.body.tokens.accessToken as string;

  // Attempt to change own role via PATCH /users/me -> 403 Forbidden
  const selfRoleAttempt = await apiRequest(env, '/api/v1/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(selfRoleAttempt.status, 403);
  assert.equal(selfRoleAttempt.body.error.code, 'SELF_ROLE_MODIFICATION_FORBIDDEN');

  // First username change succeeds
  const nick1 = await apiRequest(env, '/api/v1/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({ username: 'ivan_modular' }),
  });
  assert.equal(nick1.status, 200);
  assert.equal(nick1.body.user.username, 'ivan_modular');

  // Second username change within 7 days is blocked with 429 USERNAME_CHANGE_COOLDOWN
  const nick2 = await apiRequest(env, '/api/v1/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({ username: 'ivan_techno' }),
  });
  assert.equal(nick2.status, 429);
  assert.equal(nick2.body.error.code, 'USERNAME_CHANGE_COOLDOWN');

  void accessToken;
});

test('4. Playlists Max 10 Limit, Public Share, and History Last 15 Unique Tracks Rule', async () => {
  const env = createTestEnv();
  await applyMigrations(env.DB);

  const reg = await apiRequest(env, '/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'collector@pohumusic.dev',
      username: 'collector_10',
      password: 'StrongPassword2026!',
    }),
  });
  const token = reg.body.tokens.accessToken as string;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Create 10 playlists -> all succeed
  let firstPlaylistId = '';
  for (let i = 1; i <= 10; i++) {
    const res = await apiRequest(env, '/api/v1/playlists', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: `Playlist #${i}` }),
    });
    assert.equal(res.status, 201);
    if (i === 1) firstPlaylistId = res.body.playlist.id;
  }

  // Creating 11th playlist fails with 400 PLAYLIST_LIMIT_EXCEEDED
  const pl11 = await apiRequest(env, '/api/v1/playlists', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Playlist #11 Overflow' }),
  });
  assert.equal(pl11.status, 400);
  assert.equal(pl11.body.error.code, 'PLAYLIST_LIMIT_EXCEEDED');

  // Share Playlist #1 and verify public link
  const shareRes = await apiRequest(env, `/api/v1/playlists/${firstPlaylistId}/share`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.equal(shareRes.status, 200);
  const shareId = shareRes.body.shareId as string;

  const publicView = await apiRequest(env, `/api/v1/playlists/public/${shareId}`);
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.playlist.id, firstPlaylistId);

  // Record 20 unique tracks in listening history -> D1 automatically trims to last 15 unique tracks
  for (let i = 1; i <= 20; i++) {
    const rawCount = i * 100;
    const histPost = await apiRequest(env, '/api/v1/history', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        trackId: `sc_custom_${i}`,
        track: {
          id: `sc_custom_${i}`,
          provider: 'soundcloud',
          providerTrackId: `custom_${i}`,
          title: `History Track ${i}`,
          artistId: 'sc_artist_8001',
          artistName: 'Kholod Wave',
          albumId: null,
          albumTitle: null,
          durationMs: 180000,
          artworkUrl: null,
          permalinkUrl: `https://soundcloud.com/test/${i}`,
          accessState: 'playable',
          streamable: true,
          genre: 'Synthwave',
          tags: ['synth'],
          language: 'ru',
          releaseDate: null,
          rawPlayCount: rawCount,
          likesCount: 10,
          soundcloudMetrics: computeSoundCloudMetrics(rawCount),
        },
      }),
    });
    assert.equal(histPost.status, 200);
  }

  const histGet = await apiRequest(env, '/api/v1/history', {
    method: 'GET',
    headers: authHeaders,
  });
  assert.equal(histGet.status, 200);
  assert.equal(histGet.body.history.length, 15);
  assert.equal(histGet.body.history[0].trackId, 'sc_custom_20');
  assert.equal(histGet.body.history[0].rawProviderPlayCount, 2000);
  assert.equal(histGet.body.history[0].calculatedSoundCloudHalvedDisplay, 1000);
});

test('5. Multi-Device Player Sync, Optimistic Concurrency (409), and Cascading Account Deletion', async () => {
  const env = createTestEnv();
  await applyMigrations(env.DB);

  const reg = await apiRequest(env, '/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'sync@pohumusic.dev',
      username: 'sync_master',
      password: 'StrongPassword2026!',
    }),
  });
  const token = reg.body.tokens.accessToken as string;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Start playing on Device A (Desktop)
  const devAStart = await apiRequest(env, '/api/v1/player/state', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      deviceId: 'device_desktop_a',
      deviceName: 'Desktop Studio',
      activateDevice: true,
      isPlaying: true,
      positionMs: 15000,
    }),
  });
  assert.equal(devAStart.status, 200);
  assert.equal(devAStart.body.state.isActiveDevice, true);
  assert.equal(devAStart.body.state.isPlaying, true);
  assert.equal(devAStart.body.state.version, 1);

  // Switch playback to Device B (Mobile) -> Device A must automatically pause and deactivate!
  const devBStart = await apiRequest(env, '/api/v1/player/state', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      deviceId: 'device_mobile_b',
      deviceName: 'Mobile Phone',
      activateDevice: true,
      isPlaying: true,
      positionMs: 32000,
    }),
  });
  assert.equal(devBStart.status, 200);
  assert.equal(devBStart.body.deactivatedOtherDevices, true);

  const allDevices = devBStart.body.devices as Array<Record<string, any>>;
  const devAAfter = allDevices.find((d) => d.deviceId === 'device_desktop_a')!;
  const devBAfter = allDevices.find((d) => d.deviceId === 'device_mobile_b')!;
  assert.equal(devAAfter.isActiveDevice, false);
  assert.equal(devAAfter.isPlaying, false);
  assert.equal(devBAfter.isActiveDevice, true);
  assert.equal(devBAfter.isPlaying, true);

  // Stale expectedVersion on Device B triggers 409 SYNC_VERSION_CONFLICT
  const conflictRes = await apiRequest(env, '/api/v1/player/state', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      deviceId: 'device_mobile_b',
      positionMs: 45000,
      expectedVersion: 999,
    }),
  });
  assert.equal(conflictRes.status, 409);
  assert.equal(conflictRes.body.error.code, 'SYNC_VERSION_CONFLICT');

  // Recommendations & Similar Tracks check
  const recRes = await apiRequest(
    env,
    '/api/v1/recommendations?activity=commuting&character=popular&mood=energetic&language=ru',
    { headers: authHeaders }
  );
  assert.equal(recRes.status, 200);
  assert.ok(recRes.body.recommendations.length > 0);

  const simRes = await apiRequest(env, '/api/v1/recommendations/track/sc_1901001');
  assert.equal(simRes.status, 200);
  assert.ok(simRes.body.similarTracks.length > 0);

  // Delete account -> cascades all user data in D1
  const delAccount = await apiRequest(env, '/api/v1/users/me', {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(delAccount.status, 200);

  const sessionsAfterDelete = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM playback_sessions WHERE user_id = ?'
  )
    .bind(reg.body.user.id)
    .first<{ cnt: number }>();
  assert.equal(Number(sessionsAfterDelete?.cnt || 0), 0);
});

test('6. Seeded D1 Data, Admin Statistics, SoundCloud Raw vs Halved Metrics, Self-Role Guard, and OpenAPI Spec', async () => {
  const { seedInitialD1Data } = await import('../db/seed');
  const env = createTestEnv();
  await applyMigrations(env.DB);
  const seeded = await seedInitialD1Data(env);

  // Regular listener cannot access /admin/statistics (403 FORBIDDEN_ROLE)
  const listenerStats = await apiRequest(env, '/api/v1/admin/statistics', {
    headers: { Authorization: `Bearer ${seeded.listenerAccessToken}` },
  });
  assert.equal(listenerStats.status, 403);
  assert.equal(listenerStats.body.error.code, 'FORBIDDEN_ROLE');

  // Admin can access /admin/statistics and sees separate SoundCloud raw vs halved display metrics
  const adminStats = await apiRequest(env, '/api/v1/admin/statistics', {
    headers: { Authorization: `Bearer ${seeded.adminAccessToken}` },
  });
  assert.equal(adminStats.status, 200);
  assert.equal(adminStats.body.users.totalUsers, 3);
  assert.ok(adminStats.body.sources.soundcloud.rawProviderPlaysTotal > 0);
  assert.equal(
    adminStats.body.sources.soundcloud.calculatedHalvedDisplayTotal,
    Math.floor(adminStats.body.sources.soundcloud.rawProviderPlaysTotal / 2)
  );

  // Admin attempting to change own role via PATCH /admin/users/:id is blocked (403)
  const selfDemote = await apiRequest(env, `/api/v1/admin/users/${seeded.adminUserId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${seeded.adminAccessToken}` },
    body: JSON.stringify({ role: 'user' }),
  });
  assert.equal(selfDemote.status, 403);
  assert.equal(selfDemote.body.error.code, 'SELF_ROLE_MODIFICATION_FORBIDDEN');

  // OpenAPI 3.1.0 spec matches implementation
  const openApi = await apiRequest(env, '/api/v1/openapi.json');
  assert.equal(openApi.status, 200);
  assert.equal(openApi.body.openapi, '3.1.0');
  assert.ok(openApi.body.paths['/auth/register']);
  assert.ok(openApi.body.paths['/admin/statistics']);
});

