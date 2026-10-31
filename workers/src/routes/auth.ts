// ============================================================================
// POHUMUSIC — AUTHENTICATION ROUTES (/api/v1/auth/*)
// ============================================================================
// Implements:
// - POST /auth/register
// - POST /auth/login (with brute-force lockout protection)
// - POST /auth/logout
// - POST /auth/refresh (with refresh token rotation & reuse detection)
// - POST /auth/forgot-password (honestly reports SMTP configuration status)
// - POST /auth/reset-password
// - POST /auth/verify-email
// - GET  /auth/me
// - GET  /auth/sessions & DELETE /auth/sessions/:sessionId (Device management)
// - GET  /auth/oauth/:provider/start & POST /auth/oauth/:provider/callback
// ============================================================================

import { Hono } from 'hono';
import {
  APP_CONSTANTS,
  getJwtAccessSecret,
  getJwtRefreshSecret,
  getGoogleOAuthCredentials,
  getDiscordOAuthCredentials,
  type AppVariables,
  type Env,
} from '../config';
import { requireAuthMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import {
  sanitizeText,
  validateEmail,
  validatePassword,
  validateUsername,
} from '../middleware/validation';
import { dispatchTransactionalEmail } from '../services/email';
import {
  hashPassword,
  sha256Hex,
  signJwt,
  verifyJwt,
  verifyPassword,
} from '../utils/crypto';
import { ApiError, recordAdminLog } from '../utils/errors';
import { generateId, generateSecureHexToken, nowIso } from '../utils/id';

export const authRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const authRateLimit = rateLimitMiddleware({
  bucketPrefix: 'auth_sensitive',
  maxRequests: 25,
  windowSeconds: 60,
});

async function issueSessionTokens(
  env: Env,
  user: {
    id: string;
    email: string;
    username: string;
    display_name: string;
    role: 'user' | 'moderator' | 'admin';
  },
  deviceInfo: {
    deviceId: string;
    deviceName: string;
    deviceType: 'web' | 'desktop' | 'mobile' | 'tablet' | 'other';
    ipAddress: string;
    userAgent: string;
    existingSessionId?: string;
    tokenFamily?: string;
  }
) {
  const sessionId = deviceInfo.existingSessionId || generateId('sess');
  const tokenFamily = deviceInfo.tokenFamily || generateId('fam');
  const now = nowIso();
  const expiresAt = new Date(
    Date.now() + APP_CONSTANTS.REFRESH_TOKEN_TTL_SECONDS * 1000
  ).toISOString();

  const accessToken = await signJwt(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      sid: sessionId,
      did: deviceInfo.deviceId,
      type: 'access',
    },
    getJwtAccessSecret(env),
    APP_CONSTANTS.ACCESS_TOKEN_TTL_SECONDS
  );

  const refreshToken = await signJwt(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      sid: sessionId,
      did: deviceInfo.deviceId,
      fam: tokenFamily,
      type: 'refresh',
    },
    getJwtRefreshSecret(env),
    APP_CONSTANTS.REFRESH_TOKEN_TTL_SECONDS
  );

  const refreshTokenHash = await sha256Hex(refreshToken);

  if (deviceInfo.existingSessionId) {
    await env.DB.prepare(
      `UPDATE user_sessions
       SET refresh_token_hash = ?,
           expires_at = ?,
           last_active_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(refreshTokenHash, expiresAt, now, now, sessionId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO user_sessions (
        id, user_id, refresh_token_hash, token_family, device_id,
        device_name, device_type, ip_address, user_agent, is_revoked,
        expires_at, last_active_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    )
      .bind(
        sessionId,
        user.id,
        refreshTokenHash,
        tokenFamily,
        deviceInfo.deviceId,
        deviceInfo.deviceName,
        deviceInfo.deviceType,
        deviceInfo.ipAddress,
        deviceInfo.userAgent,
        expiresAt,
        now,
        now,
        now
      )
      .run();
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: APP_CONSTANTS.ACCESS_TOKEN_TTL_SECONDS,
    sessionId,
    deviceId: deviceInfo.deviceId,
  };
}

// POST /api/v1/auth/register
authRouter.post('/register', authRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = validateEmail(body.email);
  const username = validateUsername(body.username);
  const password = validatePassword(body.password);
  const displayName = sanitizeText(body.displayName || username, 'displayName', 64, false);
  const deviceId = sanitizeText(
    body.deviceId || c.req.header('X-Device-Id') || generateId('dev'),
    'deviceId',
    64,
    false
  );
  const deviceName = sanitizeText(
    body.deviceName || c.req.header('X-Device-Name') || 'Web Browser',
    'deviceName',
    64,
    false
  );

  const existing = await c.env.DB.prepare(
    'SELECT id, email, username FROM users WHERE email = ? OR username = ?'
  )
    .bind(email, username)
    .first<{ id: string; email: string; username: string }>();

  if (existing) {
    throw new ApiError(
      409,
      'USER_ALREADY_EXISTS',
      existing.email.toLowerCase() === email
        ? 'An account with this email already exists.'
        : 'This username is already taken.'
    );
  }

  const userId = generateId('usr');
  const now = nowIso();
  const passwordHash = await hashPassword(password, c.env.PASSWORD_PEPPER || '');

  await c.env.DB.prepare(
    `INSERT INTO users (
      id, email, username, display_name, password_hash, password_algo,
      role, email_verified, is_suspended, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'argon2id-v1', 'user', 0, 0, 1, ?, ?)`
  )
    .bind(userId, email, username, displayName, passwordHash, now, now)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)`
  )
    .bind(userId, now)
    .run();

  // Create email verification token
  const rawVerifyToken = generateSecureHexToken(24);
  const verifyTokenHash = await sha256Hex(rawVerifyToken);
  const verifyExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO email_verifications (id, user_id, email, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(generateId('ev'), userId, email, verifyTokenHash, verifyExpires, now)
    .run();

  const emailDispatch = await dispatchTransactionalEmail(c.env, {
    to: email,
    subject: 'PohuMusic — Подтверждение Email',
    textBody: `Ваш код подтверждения Email: ${rawVerifyToken}`,
    actionToken: rawVerifyToken,
  });

  const tokens = await issueSessionTokens(
    c.env,
    {
      id: userId,
      email,
      username,
      display_name: displayName,
      role: 'user',
    },
    {
      deviceId,
      deviceName,
      deviceType: 'web',
      ipAddress: c.get('clientIp'),
      userAgent: c.req.header('User-Agent') || 'unknown',
    }
  );

  return c.json(
    {
      user: {
        id: userId,
        email,
        username,
        displayName,
        role: 'user',
        emailVerified: false,
        createdAt: now,
      },
      tokens,
      emailVerification: emailDispatch,
    },
    201
  );
});

// POST /api/v1/auth/login
authRouter.post('/login', authRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const loginIdentifier = sanitizeText(
    body.email || body.username || body.identifier,
    'identifier',
    160,
    false
  ).toLowerCase();
  const password = validatePassword(body.password);
  const deviceId = sanitizeText(
    body.deviceId || c.req.header('X-Device-Id') || generateId('dev'),
    'deviceId',
    64,
    false
  );
  const deviceName = sanitizeText(
    body.deviceName || c.req.header('X-Device-Name') || 'Web Browser',
    'deviceName',
    64,
    false
  );

  const user = await c.env.DB.prepare(
    `SELECT id, email, username, display_name, password_hash, role,
            email_verified, is_suspended, failed_login_attempts, locked_until
     FROM users
     WHERE lower(email) = ? OR lower(username) = ?`
  )
    .bind(loginIdentifier, loginIdentifier)
    .first<{
      id: string;
      email: string;
      username: string;
      display_name: string;
      password_hash: string | null;
      role: 'user' | 'moderator' | 'admin';
      email_verified: number;
      is_suspended: number;
      failed_login_attempts: number;
      locked_until: string | null;
    }>();

  if (!user || !user.password_hash) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/username or password.');
  }

  if (user.is_suspended === 1) {
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended by an administrator.');
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new ApiError(
      423,
      'ACCOUNT_TEMPORARILY_LOCKED',
      `Account is temporarily locked due to repeated failed login attempts until ${user.locked_until}.`
    );
  }

  const valid = await verifyPassword(password, user.password_hash, c.env.PASSWORD_PEPPER || '');
  if (!valid) {
    const nextAttempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil: string | null = null;
    if (nextAttempts >= APP_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS) {
      lockedUntil = new Date(
        Date.now() + APP_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60 * 1000
      ).toISOString();
    }

    await c.env.DB.prepare(
      'UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?'
    )
      .bind(nextAttempts, lockedUntil, nowIso(), user.id)
      .run();

    await recordAdminLog(c.env.DB, {
      actorUserId: user.id,
      category: 'security',
      severity: lockedUntil ? 'error' : 'warn',
      action: 'failed_login_attempt',
      targetType: 'user',
      targetId: user.id,
      statusCode: 401,
      message: `Failed login attempt #${nextAttempts} for ${user.username}`,
      ipAddress: c.get('clientIp'),
    });

    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/username or password.');
  }

  // Reset failed login counter
  await c.env.DB.prepare(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?'
  )
    .bind(nowIso(), user.id)
    .run();

  const tokens = await issueSessionTokens(c.env, user, {
    deviceId,
    deviceName,
    deviceType: 'web',
    ipAddress: c.get('clientIp'),
    userAgent: c.req.header('User-Agent') || 'unknown',
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      emailVerified: user.email_verified === 1,
    },
    tokens,
  });
});

// POST /api/v1/auth/logout
authRouter.post('/logout', requireAuthMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as { revokeAllDevices?: boolean };
  const now = nowIso();

  if (body.revokeAllDevices) {
    await c.env.DB.prepare(
      'UPDATE user_sessions SET is_revoked = 1, updated_at = ? WHERE user_id = ?'
    )
      .bind(now, user.id)
      .run();
  } else {
    await c.env.DB.prepare(
      'UPDATE user_sessions SET is_revoked = 1, updated_at = ? WHERE id = ? AND user_id = ?'
    )
      .bind(now, user.sessionId, user.id)
      .run();
  }

  return c.json({
    success: true,
    revokedSessionId: user.sessionId,
    revokedAllDevices: Boolean(body.revokeAllDevices),
  });
});

// POST /api/v1/auth/refresh (Refresh Token Rotation + Reuse Detection)
authRouter.post('/refresh', authRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { refreshToken?: string };
  const refreshToken = sanitizeText(body.refreshToken, 'refreshToken', 2048, false);

  const payload = await verifyJwt(refreshToken, getJwtRefreshSecret(c.env));
  if (!payload || payload.type !== 'refresh') {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
  }

  const incomingHash = await sha256Hex(refreshToken);
  const sessionRow = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.refresh_token_hash, s.token_family, s.device_id,
            s.device_name, s.device_type, s.is_revoked, s.expires_at,
            u.email, u.username, u.display_name, u.role, u.is_suspended
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`
  )
    .bind(payload.sid)
    .first<{
      id: string;
      user_id: string;
      refresh_token_hash: string;
      token_family: string;
      device_id: string;
      device_name: string;
      device_type: 'web' | 'desktop' | 'mobile' | 'tablet' | 'other';
      is_revoked: number;
      expires_at: string;
      email: string;
      username: string;
      display_name: string;
      role: 'user' | 'moderator' | 'admin';
      is_suspended: number;
    }>();

  if (!sessionRow || sessionRow.is_revoked === 1 || sessionRow.is_suspended === 1) {
    throw new ApiError(401, 'SESSION_REVOKED', 'Session has been revoked or user is suspended.');
  }

  // Token reuse detection: if hash does not match the latest active hash in this family, revoke the entire family!
  if (sessionRow.refresh_token_hash !== incomingHash) {
    await c.env.DB.prepare(
      'UPDATE user_sessions SET is_revoked = 1, updated_at = ? WHERE token_family = ?'
    )
      .bind(nowIso(), sessionRow.token_family)
      .run();

    await recordAdminLog(c.env.DB, {
      actorUserId: sessionRow.user_id,
      category: 'security',
      severity: 'critical',
      action: 'refresh_token_reuse_detected',
      targetType: 'session',
      targetId: sessionRow.id,
      statusCode: 401,
      message: `Refresh token reuse detected for family ${sessionRow.token_family}. Revoked session family.`,
      ipAddress: c.get('clientIp'),
    });

    throw new ApiError(
      401,
      'REFRESH_TOKEN_REUSED',
      'Refresh token has already been rotated. Session family revoked for security.'
    );
  }

  const rotatedTokens = await issueSessionTokens(
    c.env,
    {
      id: sessionRow.user_id,
      email: sessionRow.email,
      username: sessionRow.username,
      display_name: sessionRow.display_name,
      role: sessionRow.role,
    },
    {
      deviceId: sessionRow.device_id,
      deviceName: sessionRow.device_name,
      deviceType: sessionRow.device_type,
      ipAddress: c.get('clientIp'),
      userAgent: c.req.header('User-Agent') || 'unknown',
      existingSessionId: sessionRow.id,
      tokenFamily: sessionRow.token_family,
    }
  );

  return c.json({
    tokens: rotatedTokens,
    rotatedAt: nowIso(),
  });
});

// POST /api/v1/auth/forgot-password
authRouter.post('/forgot-password', authRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = validateEmail(body.email);

  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE lower(email) = ?')
    .bind(email)
    .first<{ id: string; email: string }>();

  const rawResetToken = generateSecureHexToken(24);
  if (user) {
    const tokenHash = await sha256Hex(rawResetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, requested_ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(generateId('pwr'), user.id, tokenHash, expiresAt, c.get('clientIp'), nowIso())
      .run();
  }

  const emailDispatch = await dispatchTransactionalEmail(c.env, {
    to: email,
    subject: 'PohuMusic — Сброс пароля',
    textBody: `Токен для сброса пароля: ${rawResetToken}`,
    actionToken: user ? rawResetToken : '',
  });

  return c.json({
    success: true,
    emailServiceConfigured: emailDispatch.emailServiceConfigured,
    message: emailDispatch.providerStatusMessage,
    ...(user && emailDispatch.verificationOrResetTokenForTesting
      ? { resetTokenForDevTesting: emailDispatch.verificationOrResetTokenForTesting }
      : {}),
  });
});

// POST /api/v1/auth/reset-password
authRouter.post('/reset-password', authRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = sanitizeText(body.token, 'token', 256, false);
  const newPassword = validatePassword(body.newPassword);

  const tokenHash = await sha256Hex(token);
  const resetRow = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at, consumed_at
     FROM password_resets
     WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{
      id: string;
      user_id: string;
      expires_at: string;
      consumed_at: string | null;
    }>();

  if (!resetRow || resetRow.consumed_at || new Date(resetRow.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, 'INVALID_OR_EXPIRED_RESET_TOKEN', 'Password reset token is invalid or expired.');
  }

  const now = nowIso();
  const newHash = await hashPassword(newPassword, c.env.PASSWORD_PEPPER || '');

  await c.env.DB.prepare('UPDATE password_resets SET consumed_at = ? WHERE id = ?')
    .bind(now, resetRow.id)
    .run();

  await c.env.DB.prepare(
    `UPDATE users
     SET password_hash = ?,
         failed_login_attempts = 0,
         locked_until = NULL,
         version = version + 1,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(newHash, now, resetRow.user_id)
    .run();

  // Revoke existing sessions on password reset for safety
  await c.env.DB.prepare('UPDATE user_sessions SET is_revoked = 1, updated_at = ? WHERE user_id = ?')
    .bind(now, resetRow.user_id)
    .run();

  return c.json({
    success: true,
    message: 'Пароль успешно обновлён. Все предыдущие сессии отозваны.',
  });
});

// POST /api/v1/auth/verify-email
authRouter.post('/verify-email', authRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = sanitizeText(body.token, 'token', 256, false);
  const tokenHash = await sha256Hex(token);

  const row = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at, consumed_at
     FROM email_verifications
     WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{
      id: string;
      user_id: string;
      expires_at: string;
      consumed_at: string | null;
    }>();

  if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'Email verification token is invalid or expired.');
  }

  const now = nowIso();
  await c.env.DB.prepare('UPDATE email_verifications SET consumed_at = ? WHERE id = ?')
    .bind(now, row.id)
    .run();

  await c.env.DB.prepare(
    'UPDATE users SET email_verified = 1, version = version + 1, updated_at = ? WHERE id = ?'
  )
    .bind(now, row.user_id)
    .run();

  return c.json({
    success: true,
    emailVerified: true,
  });
});

// GET /api/v1/auth/me
authRouter.get('/me', requireAuthMiddleware, async (c) => {
  const authUser = c.get('user')!;
  const userRow = await c.env.DB.prepare(
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
      role: 'user' | 'moderator' | 'admin';
      email_verified: number;
      avatar_url: string | null;
      bio: string | null;
      username_changed_at: string | null;
      version: number;
      created_at: string;
      updated_at: string;
    }>();

  if (!userRow) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const sessionsRes = await c.env.DB.prepare(
    `SELECT id, device_id, device_name, device_type, ip_address, last_active_at, created_at
     FROM user_sessions
     WHERE user_id = ? AND is_revoked = 0
     ORDER BY last_active_at DESC`
  )
    .bind(authUser.id)
    .all();

  const oauthRes = await c.env.DB.prepare(
    `SELECT provider, provider_email, provider_username, created_at
     FROM oauth_accounts WHERE user_id = ?`
  )
    .bind(authUser.id)
    .all();

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
      version: userRow.version,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    },
    currentSessionId: authUser.sessionId,
    currentDeviceId: authUser.deviceId,
    activeSessions: sessionsRes.results,
    connectedOAuthAccounts: oauthRes.results,
  });
});

// GET /api/v1/auth/oauth/:provider/start (State-protected OAuth 2.0 initiation for Google & Discord)
authRouter.get('/oauth/:provider/start', authRateLimit, async (c) => {
  const providerParam = c.req.param('provider');
  const provider = (providerParam || '').toLowerCase();
  if (provider !== 'google' && provider !== 'discord') {
    throw new ApiError(400, 'UNSUPPORTED_OAUTH_PROVIDER', 'Supported OAuth providers: google, discord.');
  }

  const reqUrl = new URL(c.req.url);
  const clientRequestedRedirect = c.req.query('redirect_uri');
  const defaultRedirect = `${reqUrl.origin}/api/v1/auth/oauth/${provider}/callback`;
  const redirectUri =
    clientRequestedRedirect ||
    (provider === 'google' ? c.env.GOOGLE_REDIRECT_URI : c.env.DISCORD_REDIRECT_URI) ||
    defaultRedirect;

  const state = generateSecureHexToken(24);
  await c.env.KV.put(
    `oauth:state:${state}`,
    JSON.stringify({ provider, redirectUri, createdAt: nowIso() }),
    {
      expirationTtl: 600,
    }
  );

  if (provider === 'google') {
    const creds = getGoogleOAuthCredentials(c.env);
    const clientId = creds.clientId;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}&prompt=select_account`;

    return c.json({
      provider: 'google',
      configured: Boolean(creds.clientId && creds.clientSecret),
      state,
      redirectUri,
      authorizationUrl: authUrl,
      authUrl,
    });
  }

  const creds = getDiscordOAuthCredentials(c.env);
  const clientId = creds.clientId;
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent('identify email')}&state=${state}&prompt=consent`;

  return c.json({
    provider: 'discord',
    configured: Boolean(creds.clientId && creds.clientSecret),
    state,
    redirectUri,
    authorizationUrl: authUrl,
    authUrl,
  });
});

async function processOAuthExchange(
  c: import('hono').Context<{ Bindings: Env; Variables: AppVariables }>,
  provider: 'google' | 'discord',
  code: string,
  state: string
) {
  const storedState = (await c.env.KV.get(`oauth:state:${state}`, {
    type: 'json',
  })) as { provider?: string; redirectUri?: string; createdAt?: string } | null;

  if (!storedState || storedState.provider !== provider) {
    await recordAdminLog(c.env.DB, {
      category: 'security',
      severity: 'warn',
      action: 'oauth_state_mismatch',
      provider,
      statusCode: 400,
      message: `Invalid or expired OAuth state parameter on ${provider} callback`,
      ipAddress: c.get('clientIp'),
    });
    throw new ApiError(400, 'INVALID_OAUTH_STATE', 'OAuth state parameter is invalid or expired (CSRF protection).');
  }

  await c.env.KV.delete(`oauth:state:${state}`);

  const reqUrl = new URL(c.req.url);
  const redirectUri =
    storedState.redirectUri ||
    (provider === 'google' ? c.env.GOOGLE_REDIRECT_URI : c.env.DISCORD_REDIRECT_URI) ||
    `${reqUrl.origin}/api/v1/auth/oauth/${provider}/callback`;

  let providerUserId = '';
  let providerEmail = '';
  let providerDisplayName = '';
  let providerAvatarUrl: string | null = null;
  let rawAccessToken = '';
  let rawRefreshToken: string | null = null;
  let expiresIn = 3600;

  if (provider === 'google') {
    const creds = getGoogleOAuthCredentials(c.env);
    const clientId = creds.clientId;
    const clientSecret = creds.clientSecret;
    if (!clientId || !clientSecret) {
      throw new ApiError(503, 'OAUTH_CREDENTIALS_NOT_CONFIGURED', 'Google OAuth credentials not configured on server.');
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const tokenData = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new ApiError(
        400,
        'OAUTH_EXCHANGE_FAILED',
        `Google token exchange failed: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`
      );
    }

    rawAccessToken = tokenData.access_token;
    rawRefreshToken = tokenData.refresh_token || null;
    expiresIn = tokenData.expires_in || 3600;

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${rawAccessToken}` },
    });
    const userData = (await userRes.json().catch(() => ({}))) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };

    if (!userRes.ok || !userData.sub) {
      throw new ApiError(400, 'OAUTH_PROFILE_FAILED', 'Failed to retrieve profile from Google UserInfo API.');
    }

    providerUserId = userData.sub;
    providerEmail = (userData.email || '').toLowerCase();
    providerDisplayName = userData.name || 'Google User';
    providerAvatarUrl = userData.picture || null;
  } else {
    // Discord
    const creds = getDiscordOAuthCredentials(c.env);
    const clientId = creds.clientId;
    const clientSecret = creds.clientSecret;
    if (!clientId || !clientSecret) {
      throw new ApiError(503, 'OAUTH_CREDENTIALS_NOT_CONFIGURED', 'Discord OAuth credentials not configured on server.');
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const tokenData = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new ApiError(
        400,
        'OAUTH_EXCHANGE_FAILED',
        `Discord token exchange failed: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`
      );
    }

    rawAccessToken = tokenData.access_token;
    rawRefreshToken = tokenData.refresh_token || null;
    expiresIn = tokenData.expires_in || 3600;

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${rawAccessToken}` },
    });
    const userData = (await userRes.json().catch(() => ({}))) as {
      id?: string;
      username?: string;
      global_name?: string;
      email?: string;
      avatar?: string;
    };

    if (!userRes.ok || !userData.id) {
      throw new ApiError(400, 'OAUTH_PROFILE_FAILED', 'Failed to retrieve profile from Discord API.');
    }

    providerUserId = userData.id;
    providerEmail = (userData.email || `${userData.username}@discord.pohumusic.local`).toLowerCase();
    providerDisplayName = userData.global_name || userData.username || 'Discord User';
    providerAvatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : null;
  }

  const now = nowIso();
  const oauthExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // 1. Check if OAuth account is already linked
  const linkedAccount = await c.env.DB.prepare(
    `SELECT a.id, a.user_id, u.email, u.username, u.display_name, u.role, u.is_suspended, u.email_verified
     FROM oauth_accounts a
     JOIN users u ON u.id = a.user_id
     WHERE a.provider = ? AND a.provider_user_id = ?`
  )
    .bind(provider, providerUserId)
    .first<{
      id: string;
      user_id: string;
      email: string;
      username: string;
      display_name: string;
      role: 'user' | 'moderator' | 'admin';
      is_suspended: number;
      email_verified: number;
    }>();

  let targetUser: {
    id: string;
    email: string;
    username: string;
    display_name: string;
    role: 'user' | 'moderator' | 'admin';
  };

  if (linkedAccount) {
    if (linkedAccount.is_suspended === 1) {
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended by an administrator.');
    }

    await c.env.DB.prepare(
      `UPDATE oauth_accounts
       SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(rawAccessToken, rawRefreshToken, oauthExpiresAt, now, linkedAccount.id)
      .run();

    targetUser = {
      id: linkedAccount.user_id,
      email: linkedAccount.email,
      username: linkedAccount.username,
      display_name: linkedAccount.display_name,
      role: linkedAccount.role,
    };
  } else {
    // 2. Check if a user with this email already exists
    const existingUser = await c.env.DB.prepare(
      `SELECT id, email, username, display_name, role, is_suspended
       FROM users WHERE lower(email) = ?`
    )
      .bind(providerEmail)
      .first<{
        id: string;
        email: string;
        username: string;
        display_name: string;
        role: 'user' | 'moderator' | 'admin';
        is_suspended: number;
      }>();

    if (existingUser) {
      if (existingUser.is_suspended === 1) {
        throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended by an administrator.');
      }

      await c.env.DB.prepare(
        `INSERT INTO oauth_accounts (
          id, user_id, provider, provider_user_id, provider_email,
          provider_username, access_token, refresh_token, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          generateId('oa'),
          existingUser.id,
          provider,
          providerUserId,
          providerEmail,
          providerDisplayName,
          rawAccessToken,
          rawRefreshToken,
          oauthExpiresAt,
          now,
          now
        )
        .run();

      targetUser = {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
        display_name: existingUser.display_name,
        role: existingUser.role,
      };
    } else {
      // 3. Create brand new user
      const newUserId = generateId('usr');
      let baseUsername = providerDisplayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 14);

      if (baseUsername.length < 3) {
        baseUsername = `${provider}_user`;
      }

      const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
        .bind(baseUsername)
        .first();

      const finalUsername = existingUsername
        ? `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`
        : baseUsername;

      await c.env.DB.prepare(
        `INSERT INTO users (
          id, email, username, display_name, avatar_url, role,
          email_verified, is_suspended, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'user', 1, 0, 1, ?, ?)`
      )
        .bind(newUserId, providerEmail, finalUsername, providerDisplayName, providerAvatarUrl, now, now)
        .run();

      await c.env.DB.prepare('INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)')
        .bind(newUserId, now)
        .run();

      await c.env.DB.prepare(
        `INSERT INTO oauth_accounts (
          id, user_id, provider, provider_user_id, provider_email,
          provider_username, access_token, refresh_token, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          generateId('oa'),
          newUserId,
          provider,
          providerUserId,
          providerEmail,
          providerDisplayName,
          rawAccessToken,
          rawRefreshToken,
          oauthExpiresAt,
          now,
          now
        )
        .run();

      targetUser = {
        id: newUserId,
        email: providerEmail,
        username: finalUsername,
        display_name: providerDisplayName,
        role: 'user',
      };
    }
  }

  const deviceId = generateId('dev');
  const tokens = await issueSessionTokens(c.env, targetUser, {
    deviceId,
    deviceName: `${provider.toUpperCase()} Auth Client`,
    deviceType: 'web',
    ipAddress: c.get('clientIp'),
    userAgent: c.req.header('User-Agent') || 'OAuth Callback',
  });

  return {
    provider,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      username: targetUser.username,
      displayName: targetUser.display_name,
      role: targetUser.role,
    },
    tokens,
  };

  // Save for Desktop/Mobile client polling via state token
  await c.env.KV.put(
    `oauth:completed:${state}`,
    JSON.stringify({
      status: 'authenticated',
      ...result,
    }),
    { expirationTtl: 600 }
  );

  return result;
}

// GET /api/v1/auth/oauth/status (Check completion of external browser OAuth)
authRouter.get('/oauth/status', async (c) => {
  const state = c.req.query('state') || '';
  if (!state) {
    return c.json({ status: 'missing_state' }, 400);
  }

  const completed = (await c.env.KV.get(`oauth:completed:${state}`, {
    type: 'json',
  })) as {
    status: string;
    user: any;
    tokens: any;
    provider: string;
  } | null;

  if (completed) {
    await c.env.KV.delete(`oauth:completed:${state}`);
    return c.json(completed);
  }

  return c.json({ status: 'pending' });
});

// GET /api/v1/auth/oauth/:provider/callback (Popup-based OAuth redirect handler)
authRouter.get('/oauth/:provider/callback', async (c) => {
  const provider = c.req.param('provider').toLowerCase();
  if (provider !== 'google' && provider !== 'discord') {
    return c.html(`<html><body><p>Unsupported provider</p></body></html>`, 400);
  }

  const code = c.req.query('code') || '';
  const state = c.req.query('state') || '';
  const error = c.req.query('error') || '';

  if (error || !code || !state) {
    const errorMsg = error || 'Отсутствует код авторизации или параметр state';
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>PohuMusic Auth Error</title></head>
      <body style="background:#0b0f19;color:#f87171;font-family:sans-serif;padding:32px;text-align:center;">
        <h2 style="color:#ef4444;">Ошибка авторизации ${provider.toUpperCase()}</h2>
        <p style="color:#cbd5e1;">${errorMsg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: ${JSON.stringify(provider)}, error: ${JSON.stringify(errorMsg)} }, '*');
            setTimeout(() => window.close(), 2500);
          }
        </script>
      </body>
      </html>
    `, 400);
  }

  try {
    const result = await processOAuthExchange(c, provider as 'google' | 'discord', code, state);
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PohuMusic — Успешная авторизация</title>
      </head>
      <body style="background:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:36px;background:#111827;border-radius:16px;border:1px solid #1e293b;max-width:440px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="font-size:36px;margin-bottom:12px;">✅</div>
          <h2 style="font-size:20px;margin:0 0 8px;color:#34d399;">Авторизация успешна!</h2>
          <p style="font-size:14px;color:#94a3b8;margin:0 0 16px;line-height:1.5;">Вы успешно вошли через ${provider.toUpperCase()} как <strong>${result.user.displayName}</strong>.<br><br>Можете закрыть эту вкладку и вернуться в приложение PohuMusic.</p>
        </div>
        <script>
          const payload = ${JSON.stringify({
            type: 'OAUTH_AUTH_SUCCESS',
            provider: result.provider,
            tokens: result.tokens,
            user: result.user,
          })};
          if (window.opener) {
            window.opener.postMessage(payload, '*');
            setTimeout(() => window.close(), 400);
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Unknown error');
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>PohuMusic Auth Error</title></head>
      <body style="background:#0b0f19;color:#f87171;font-family:sans-serif;padding:32px;text-align:center;">
        <h2 style="color:#ef4444;">Сбой авторизации ${provider.toUpperCase()}</h2>
        <p style="color:#cbd5e1;font-family:monospace;font-size:14px;">${message}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: ${JSON.stringify(provider)}, error: ${JSON.stringify(message)} }, '*');
            setTimeout(() => window.close(), 3000);
          }
        </script>
      </body>
      </html>
    `, 400);
  }
});

// POST /api/v1/auth/oauth/:provider/callback (API client code exchange)
authRouter.post('/oauth/:provider/callback', authRateLimit, async (c) => {
  const providerParam = c.req.param('provider');
  const provider = (providerParam || '').toLowerCase();
  if (provider !== 'google' && provider !== 'discord') {
    throw new ApiError(400, 'UNSUPPORTED_OAUTH_PROVIDER', 'Supported OAuth providers: google, discord.');
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    state?: string;
    code?: string;
  };
  const state = sanitizeText(body.state, 'state', 128, false);
  const code = sanitizeText(body.code, 'code', 1024, false);

  const result = await processOAuthExchange(c, provider as 'google' | 'discord', code, state);
  return c.json(result);
});
