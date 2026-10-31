// ============================================================================
// POHUMUSIC — CLOUDFLARE WORKERS CONFIGURATION & ENVIRONMENT BINDINGS
// ============================================================================

export interface D1Meta {
  duration: number;
  changes: number;
  last_row_id: number;
  changed_db: boolean;
  size_after: number;
  rows_read: number;
  rows_written: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
  error?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface KVNamespacePutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: unknown;
}

export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' }): Promise<string | null | unknown>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: Array<{ name: string; expiration?: number }> }>;
}

export interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Cloudflare Worker Bindings & Secrets
 * Strictly uses D1, KV, and Workers Static Assets (R2 is prohibited).
 */
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS?: Fetcher;

  ENVIRONMENT?: string;
  APP_URL?: string;
  ALLOWED_ORIGINS?: string;

  // Secrets stored via `wrangler secret put`
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  PASSWORD_PEPPER?: string;

  SOUNDCLOUD_CLIENT_ID?: string;
  SOUNDCLOUD_CLIENT_SECRET?: string;
  SOUNDCLOUD_API_BASE_URL?: string;
  SOUNDCLOUD_TOKEN_URL?: string;

  YOUTUBE_API_KEY?: string;
  YOUTUBE_DAILY_QUOTA_LIMIT?: string;

  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;

  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_REDIRECT_URI?: string;

  SMTP_PROVIDER?: string;
  SMTP_API_KEY?: string;
  SMTP_FROM_EMAIL?: string;
}

export interface AuthUserContext {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  sessionId: string;
  deviceId: string;
}

export interface AppVariables {
  user?: AuthUserContext;
  requestId: string;
  clientIp: string;
}

export const APP_CONSTANTS = {
  API_PREFIX: '/api/v1',
  MAX_PLAYLISTS_PER_USER: 10,
  MAX_UNIQUE_HISTORY_TRACKS: 15,
  USERNAME_COOLDOWN_DAYS: 7,
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60, // 30 days
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  SOUNDCLOUD_CACHE_TTL_SECONDS: 300,
  YOUTUBE_CACHE_TTL_SECONDS: 600,
} as const;

export function getJwtAccessSecret(env: Env): string {
  return env.JWT_ACCESS_SECRET || 'pohumusic-dev-access-secret-key-minimum-32-bytes-2026';
}

export function getJwtRefreshSecret(env: Env): string {
  return env.JWT_REFRESH_SECRET || 'pohumusic-dev-refresh-secret-key-minimum-32-bytes-2026';
}

export function getGoogleOAuthCredentials(env: Env): { clientId: string; clientSecret: string } {
  return {
    clientId:
      env.GOOGLE_CLIENT_ID ||
      '750365132799-2fg0f63sar4aqqppnru3l7e4e2d8cnrg.apps.googleusercontent.com',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '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',
  };
}

export function getDiscordOAuthCredentials(env: Env): { clientId: string; clientSecret: string } {
  return {
    clientId: env.DISCORD_CLIENT_ID || '1565970971511357440',
    clientSecret: env.DISCORD_CLIENT_SECRET || 'Ynp4zTqs8Uy-wzyRnG9g3Q--OaJBKWQA',
  };
}

export function getResendApiKey(env: Env): string {
  return env.SMTP_API_KEY || 're_GsYvXYrU_KbtQ8QgpYgZpsG2axmuQRmzC';
}
