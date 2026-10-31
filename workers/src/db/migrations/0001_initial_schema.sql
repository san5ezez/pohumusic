-- ============================================================================
-- POHUMUSIC — CLOUDFLARE D1 INITIAL MIGRATION (0001_initial_schema.sql)
-- ============================================================================
-- Enforce foreign key constraints on every connection
PRAGMA foreign_keys = ON;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  password_algo TEXT NOT NULL DEFAULT 'argon2id-v1',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  is_suspended INTEGER NOT NULL DEFAULT 0 CHECK (is_suspended IN (0, 1)),
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  username_changed_at TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  token_family TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Web Browser',
  device_type TEXT NOT NULL DEFAULT 'web' CHECK (device_type IN ('web', 'desktop', 'mobile', 'tablet', 'other')),
  ip_address TEXT,
  user_agent TEXT,
  is_revoked INTEGER NOT NULL DEFAULT 0 CHECK (is_revoked IN (0, 1)),
  expires_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON user_sessions(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_family ON user_sessions(token_family);

-- 3. oauth_accounts
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'discord')),
  provider_account_id TEXT NOT NULL,
  provider_email TEXT,
  provider_username TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(provider, provider_account_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

-- 4. email_verifications
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

-- 5. password_resets
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  requested_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

-- 6. user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_activity TEXT NOT NULL DEFAULT 'working' CHECK (preferred_activity IN ('waking_up', 'commuting', 'working', 'training', 'falling_asleep')),
  preferred_character TEXT NOT NULL DEFAULT 'favorite' CHECK (preferred_character IN ('favorite', 'unfamiliar', 'popular')),
  preferred_mood TEXT NOT NULL DEFAULT 'calm' CHECK (preferred_mood IN ('energetic', 'cheerful', 'calm', 'sad')),
  preferred_language TEXT NOT NULL DEFAULT 'any' CHECK (preferred_language IN ('ru', 'en', 'any', 'instrumental')),
  preferred_providers TEXT NOT NULL DEFAULT '["soundcloud","youtube"]',
  autoplay_related INTEGER NOT NULL DEFAULT 1 CHECK (autoplay_related IN (0, 1)),
  crossfade_seconds INTEGER NOT NULL DEFAULT 0 CHECK (crossfade_seconds BETWEEN 0 AND 12),
  favorite_artists_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. favorites
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('soundcloud', 'youtube')),
  title TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_id TEXT,
  album_title TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  artwork_url TEXT,
  access_state TEXT NOT NULL DEFAULT 'playable' CHECK (access_state IN ('playable', 'preview', 'blocked')),
  track_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, track_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_track_id ON favorites(track_id);

-- 8. playlists (Max 10 per user enforced by trigger & service layer)
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  cover_url TEXT,
  track_count INTEGER NOT NULL DEFAULT 0 CHECK (track_count >= 0),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);

CREATE TRIGGER IF NOT EXISTS trg_playlists_max_10_per_user
BEFORE INSERT ON playlists
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM playlists WHERE user_id = NEW.user_id) >= 10
    THEN RAISE(ABORT, 'PLAYLIST_LIMIT_EXCEEDED: Maximum 10 playlists allowed per user')
  END;
END;

-- 9. playlist_tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('soundcloud', 'youtube')),
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  artwork_url TEXT,
  access_state TEXT NOT NULL DEFAULT 'playable' CHECK (access_state IN ('playable', 'preview', 'blocked')),
  track_json TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_pos ON playlist_tracks(playlist_id, position ASC);

-- 10. listening_history (Stores last 15 unique tracks per user)
CREATE TABLE IF NOT EXISTS listening_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('soundcloud', 'youtube')),
  title TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  listened_ms INTEGER NOT NULL DEFAULT 0,
  was_skipped INTEGER NOT NULL DEFAULT 0 CHECK (was_skipped IN (0, 1)),
  play_count_for_user INTEGER NOT NULL DEFAULT 1,
  raw_provider_play_count INTEGER NOT NULL DEFAULT 0,
  calculated_sc_halved_display INTEGER,
  track_json TEXT NOT NULL,
  played_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, track_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listening_history_user_played ON listening_history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_history_track ON listening_history(track_id);

-- 11. playback_sessions (Multi-device sync & single active speaker enforcement)
CREATE TABLE IF NOT EXISTS playback_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  is_active_device INTEGER NOT NULL DEFAULT 0 CHECK (is_active_device IN (0, 1)),
  current_track_id TEXT,
  current_track_json TEXT,
  position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
  is_playing INTEGER NOT NULL DEFAULT 0 CHECK (is_playing IN (0, 1)),
  volume REAL NOT NULL DEFAULT 0.85 CHECK (volume BETWEEN 0.0 AND 1.0),
  repeat_mode TEXT NOT NULL DEFAULT 'off' CHECK (repeat_mode IN ('off', 'one', 'all')),
  shuffle_enabled INTEGER NOT NULL DEFAULT 0 CHECK (shuffle_enabled IN (0, 1)),
  last_idempotency_key TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, device_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_user_active ON playback_sessions(user_id, is_active_device);

-- 12. playback_queues
CREATE TABLE IF NOT EXISTS playback_queues (
  user_id TEXT PRIMARY KEY,
  current_index INTEGER NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  tracks_json TEXT NOT NULL DEFAULT '[]',
  context_type TEXT NOT NULL DEFAULT 'custom' CHECK (context_type IN ('search', 'playlist', 'favorites', 'recommendation', 'album', 'artist', 'custom')),
  context_id TEXT,
  last_idempotency_key TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. recommendation_feedback
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('soundcloud', 'youtube')),
  artist_id TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'skip', 'complete_listen', 'dismiss')),
  activity_mode TEXT,
  character_mode TEXT,
  mood_mode TEXT,
  language_mode TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_user ON recommendation_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_track ON recommendation_feedback(track_id);

-- 14. public_shares
CREATE TABLE IF NOT EXISTS public_shares (
  share_id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_public_shares_playlist ON public_shares(playlist_id);

-- 15. admin_logs (Includes security audit logs, system events, and provider/API errors)
CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('security', 'admin_action', 'provider_error', 'rate_limit', 'sync_conflict', 'system')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  provider TEXT,
  status_code INTEGER,
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_category_created ON admin_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_severity ON admin_logs(severity, created_at DESC);

-- 16. system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
