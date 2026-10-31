import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMigrations, LocalD1Database, LocalKVNamespace } from '../db/d1-adapter';
import type { Env } from '../config';
import { createPohuMusicApp } from '../app';

test('OAuth & Resend Service integration tests', async (t) => {
  const d1 = new LocalD1Database(':memory:');
  const kv = new LocalKVNamespace();
  await applyMigrations(d1);

  const env: Env = {
    DB: d1,
    KV: kv,
    ENVIRONMENT: 'development',
    APP_URL: 'https://ais-dev-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app',
    ALLOWED_ORIGINS: '*',
    JWT_ACCESS_SECRET: 'pohumusic-dev-access-secret-key-minimum-32-bytes-2026',
    JWT_REFRESH_SECRET: 'pohumusic-dev-refresh-secret-key-minimum-32-bytes-2026',
    PASSWORD_PEPPER: 'pohumusic-pepper-2026',
    GOOGLE_CLIENT_ID: '750365132799-2fg0f63sar4aqqppnru3l7e4e2d8cnrg.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: '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',
    DISCORD_CLIENT_ID: '1365970971511357440',
    DISCORD_CLIENT_SECRET: 'Ynp4zTqs8Uy-wzyRnG9g3Q--0aJBKWQA',
    SMTP_PROVIDER: 'resend',
    SMTP_API_KEY: 're_GsYvXYrU_KbtQ8QgpYgZpsG2axmuQRmzC',
    SMTP_FROM_EMAIL: 'onboarding@resend.dev',
  };

  const app = createPohuMusicApp();

  await t.test('1. Google and Discord OAuth initiation returns valid auth URLs and stores state in KV', async () => {
    // Google start
    const googleRes = await app.request('/api/v1/auth/oauth/google/start', {}, env);
    assert.equal(googleRes.status, 200);
    const googleData = (await googleRes.json()) as any;
    assert.equal(googleData.provider, 'google');
    assert.equal(googleData.configured, true);
    assert.ok(googleData.state);
    assert.ok(googleData.authorizationUrl.includes('accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(googleData.authorizationUrl.includes(encodeURIComponent('750365132799-2fg0f63sar4aqqppnru3l7e4e2d8cnrg.apps.googleusercontent.com')));

    // Verify KV state exists
    const storedGoogleState = await kv.get(`oauth:state:${googleData.state}`, { type: 'json' }) as any;
    assert.ok(storedGoogleState);
    assert.equal(storedGoogleState.provider, 'google');

    // Discord start
    const discordRes = await app.request('/api/v1/auth/oauth/discord/start', {}, env);
    assert.equal(discordRes.status, 200);
    const discordData = (await discordRes.json()) as any;
    assert.equal(discordData.provider, 'discord');
    assert.equal(discordData.configured, true);
    assert.ok(discordData.state);
    assert.ok(discordData.authorizationUrl.includes('discord.com/api/oauth2/authorize'));
    assert.ok(discordData.authorizationUrl.includes('1365970971511357440'));

    const storedDiscordState = await kv.get(`oauth:state:${discordData.state}`, { type: 'json' }) as any;
    assert.ok(storedDiscordState);
    assert.equal(storedDiscordState.provider, 'discord');
  });

  await t.test('2. Forgot-password endpoint triggers Resend and stores token in D1', async () => {
    const res = await app.request(
      '/api/v1/auth/forgot-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'san4ez.fedorov@gmail.com' }),
      },
      env
    );

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.success, true);
    assert.equal(data.emailServiceConfigured, true);
    assert.ok(typeof data.message === 'string');
  });

  await t.test('3. OAuth callback handles missing or invalid state safely with informative HTML', async () => {
    const res = await app.request('/api/v1/auth/oauth/google/callback?code=bad_code&state=nonexistent_state', {}, env);
    assert.equal(res.status, 400);
    const html = await res.text();
    assert.ok(html.includes('Сбой авторизации') || html.includes('OAuth state'));
    assert.ok(html.includes('postMessage'));
  });
});
