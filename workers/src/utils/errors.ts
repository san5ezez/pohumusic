// ============================================================================
// POHUMUSIC — STANDARDIZED API ERRORS & LOGGING HELPERS
// ============================================================================

import type { D1Database } from '../config';
import { generateId, nowIso } from './id';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export async function recordAdminLog(
  db: D1Database,
  params: {
    actorUserId?: string | null;
    category: 'security' | 'admin_action' | 'provider_error' | 'rate_limit' | 'sync_conflict' | 'system';
    severity?: 'info' | 'warn' | 'error' | 'critical';
    action: string;
    targetType?: string;
    targetId?: string;
    provider?: string;
    statusCode?: number;
    message: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO admin_logs (
          id, actor_user_id, category, severity, action, target_type, target_id,
          provider, status_code, message, metadata_json, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId('log'),
        params.actorUserId ?? null,
        params.category,
        params.severity ?? 'info',
        params.action,
        params.targetType ?? null,
        params.targetId ?? null,
        params.provider ?? null,
        params.statusCode ?? null,
        params.message,
        JSON.stringify(params.metadata ?? {}),
        params.ipAddress ?? null,
        nowIso()
      )
      .run();
  } catch {
    // Prevent telemetry logging failure from crashing the main request flow
  }
}
