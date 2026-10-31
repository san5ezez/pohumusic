// ============================================================================
// POHUMUSIC — LOCAL CLOUDFLARE D1 & KV RUNTIME ADAPTER (FOR DEV & TESTS)
// ============================================================================
// Implements the exact Cloudflare D1Database and KVNamespace interfaces using
// Node's built-in `node:sqlite` (DatabaseSync) so that migrations, triggers,
// foreign keys, indexes, and prepared statements execute identically in local
// verification, unit tests, and the interactive preview server.
// ============================================================================

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  D1Database,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
  KVNamespace,
  KVNamespacePutOptions,
} from '../config';

class SqliteD1PreparedStatement implements D1PreparedStatement {
  private db: DatabaseSync;
  private query: string;
  private params: unknown[];

  constructor(db: DatabaseSync, query: string, params: unknown[] = []) {
    this.db = db;
    this.query = query;
    this.params = params;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    const normalized = values.map((v) => {
      if (v === undefined) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    });
    return new SqliteD1PreparedStatement(this.db, this.query, normalized);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.query);
    const row = stmt.get(...(this.params as Array<string | number | null>)) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const start = performance.now();
    const stmt = this.db.prepare(this.query);
    const info = stmt.run(...(this.params as Array<string | number | null>));
    const duration = performance.now() - start;
    return {
      results: [],
      success: true,
      meta: {
        duration,
        changes: Number(info.changes ?? 0),
        last_row_id: Number(info.lastInsertRowid ?? 0),
        changed_db: Number(info.changes ?? 0) > 0,
        size_after: 0,
        rows_read: 0,
        rows_written: Number(info.changes ?? 0),
      },
    };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const start = performance.now();
    const stmt = this.db.prepare(this.query);
    const rows = stmt.all(...(this.params as Array<string | number | null>)) as T[];
    const duration = performance.now() - start;
    return {
      results: rows,
      success: true,
      meta: {
        duration,
        changes: 0,
        last_row_id: 0,
        changed_db: false,
        size_after: 0,
        rows_read: rows.length,
        rows_written: 0,
      },
    };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const res = await this.all<Record<string, unknown>>();
    return res.results.map((r) => Object.values(r) as unknown as T);
  }
}

export class LocalD1Database implements D1Database {
  private db: DatabaseSync;

  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(query: string): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.db, query);
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const stmt of statements) {
        const trimmed = (stmt as unknown as { query: string }).query.trim().toUpperCase();
        if (trimmed.startsWith('SELECT')) {
          results.push(await stmt.all<T>());
        } else {
          results.push(await stmt.run<T>());
        }
      }
      this.db.exec('COMMIT;');
      return results;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    const start = performance.now();
    this.db.exec(query);
    return {
      count: 1,
      duration: performance.now() - start,
    };
  }
}

export class LocalKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string, options?: { type?: 'text' | 'json' }): Promise<string | null | unknown> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (options?.type === 'json') {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void> {
    let expiresAt: number | undefined;
    if (options?.expirationTtl) {
      expiresAt = Date.now() + options.expirationTtl * 1000;
    } else if (options?.expiration) {
      expiresAt = options.expiration * 1000;
    }
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<{ keys: Array<{ name: string; expiration?: number }> }> {
    const keys: Array<{ name: string; expiration?: number }> = [];
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt && now > v.expiresAt) {
        this.store.delete(k);
        continue;
      }
      if (!options?.prefix || k.startsWith(options.prefix)) {
        keys.push({
          name: k,
          expiration: v.expiresAt ? Math.floor(v.expiresAt / 1000) : undefined,
        });
      }
      if (options?.limit && keys.length >= options.limit) break;
    }
    return { keys };
  }
}

export async function applyMigrations(db: D1Database): Promise<void> {
  const migrationPath = path.resolve(process.cwd(), 'workers/src/db/migrations/0001_initial_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  await db.exec(sql);
}
