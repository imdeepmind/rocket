import crypto from 'crypto';

import {FastifyInstance} from 'fastify';

import {resolveModelField} from '@/lib/config/resolve';

import {ResolvedAppConfig, ResolvedModelConfig} from '@/interfaces/config';

import {parseDuration} from '@/utils/duration';
import {sha256} from '@/utils/hash';

export const SESSION_TABLE_NAME = '_ross_sessions';
const SESSION_CACHE_PREFIX = 'session:refresh:';

interface CacheSessionPayload {
  sessionId: string;
  userId: string;
  expiresAt: string;
}

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: string;
}

export interface RotatedSession extends IssuedSession {
  userId: string;
}

/**
 * Internal Drizzle model definition for the `_ross_sessions` table when
 * `authentication.sessionStorage` is `"db"`.
 */
export function getSessionModelConfig(): ResolvedModelConfig {
  return {
    timestamps: false,
    fields: {
      id: resolveModelField({
        type: 'string',
        primaryKey: true,
        nullable: false,
      }),
      user_id: resolveModelField({type: 'string', nullable: false}),
      token_hash: resolveModelField({
        type: 'string',
        nullable: false,
        unique: true,
      }),
      expires_at: resolveModelField({type: 'string', nullable: false}),
      created_at: resolveModelField({type: 'string', nullable: false}),
    },
    indexes: {
      idx_ross_sessions_user_id: {
        fields: ['user_id'],
        unique: false,
      },
    },
    relations: {},
  };
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function getSessionCacheKey(tokenHash: string): string {
  return `${SESSION_CACHE_PREFIX}${tokenHash}`;
}

function getAuthSessionConfig(config: ResolvedAppConfig): {
  sessionStorage: 'db' | 'cache';
  ttlMs: number;
} {
  const {authentication} = config;

  if (!authentication.enabled) {
    throw new Error('Authentication is not enabled');
  }

  return {
    sessionStorage: authentication.sessionStorage,
    ttlMs: parseDuration(authentication.refreshTokenExpiration),
  };
}

/**
 * Create a new refresh token session in the configured backend (`db` or `cache`).
 */
export async function createSession(
  app: Pick<FastifyInstance, 'db' | 'cache'>,
  config: ResolvedAppConfig,
  userId: unknown,
): Promise<IssuedSession> {
  const {sessionStorage, ttlMs} = getAuthSessionConfig(config);
  const sessionId = crypto.randomUUID();
  const refreshToken = generateRefreshToken();
  const tokenHash = sha256(refreshToken);
  const now = Date.now();
  const expiresAt = new Date(now + ttlMs).toISOString();
  const createdAt = new Date(now).toISOString();
  const userIdStr = String(userId);

  if (sessionStorage === 'cache') {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    const payload: CacheSessionPayload = {
      sessionId,
      userId: userIdStr,
      expiresAt,
    };
    await app.cache.set(getSessionCacheKey(tokenHash), payload, ttlSeconds);
    return {sessionId, refreshToken, expiresAt};
  }

  await app.db.query(
    `INSERT INTO "${SESSION_TABLE_NAME}" ("id", "user_id", "token_hash", "expires_at", "created_at") VALUES ($1, $2, $3, $4, $5);`,
    [sessionId, userIdStr, tokenHash, expiresAt, createdAt],
  );

  return {sessionId, refreshToken, expiresAt};
}

/**
 * Validate a refresh token, delete the consumed session, and issue a rotated
 * refresh token session. Returns `null` if the token is missing, invalid, or
 * expired.
 */
export async function rotateSession(
  app: Pick<FastifyInstance, 'db' | 'cache'>,
  config: ResolvedAppConfig,
  refreshToken: string,
): Promise<RotatedSession | null> {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return null;
  }

  const {sessionStorage, ttlMs} = getAuthSessionConfig(config);
  const tokenHash = sha256(refreshToken);

  if (sessionStorage === 'cache') {
    const cacheKey = getSessionCacheKey(tokenHash);
    const entry = await app.cache.get<CacheSessionPayload>(cacheKey);

    if (!entry) {
      return null;
    }

    await app.cache.delete(cacheKey);

    if (Date.parse(entry.expiresAt) <= Date.now()) {
      return null;
    }

    const next = await createSession(app, config, entry.userId);
    return {
      userId: entry.userId,
      ...next,
    };
  }

  let tx;
  try {
    tx = await app.db.beginTransaction();

    const selectRes = await tx.query<{
      id: string;
      user_id: string;
      expires_at: string;
    }>(
      `SELECT "id", "user_id", "expires_at" FROM "${SESSION_TABLE_NAME}" WHERE "token_hash" = $1 LIMIT 1;`,
      [tokenHash],
    );

    const row = selectRes.rows[0];
    if (!row) {
      await tx.commit();
      return null;
    }

    const deleteRes = await tx.query(
      `DELETE FROM "${SESSION_TABLE_NAME}" WHERE "token_hash" = $1;`,
      [tokenHash],
    );

    if (deleteRes.changes === 0 || Date.parse(row.expires_at) <= Date.now()) {
      await tx.commit();
      return null;
    }

    const newSessionId = crypto.randomUUID();
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = sha256(newRefreshToken);
    const now = Date.now();
    const newExpiresAt = new Date(now + ttlMs).toISOString();
    const createdAt = new Date(now).toISOString();
    const userIdStr = String(row.user_id);

    await tx.query(
      `INSERT INTO "${SESSION_TABLE_NAME}" ("id", "user_id", "token_hash", "expires_at", "created_at") VALUES ($1, $2, $3, $4, $5);`,
      [newSessionId, userIdStr, newTokenHash, newExpiresAt, createdAt],
    );

    await tx.commit();

    return {
      userId: userIdStr,
      sessionId: newSessionId,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    };
  } catch (err) {
    if (tx) await tx.rollback().catch(() => {});
    throw err;
  } finally {
    tx?.release();
  }
}

/**
 * Delete a refresh token session from the configured backend. When `userId` is
 * provided, only deletes the session if it belongs to that user.
 */
export async function revokeSession(
  app: Pick<FastifyInstance, 'db' | 'cache'>,
  config: ResolvedAppConfig,
  refreshToken: string,
  userId?: unknown,
): Promise<boolean> {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return false;
  }

  const {sessionStorage} = getAuthSessionConfig(config);
  const tokenHash = sha256(refreshToken);

  if (sessionStorage === 'cache') {
    const cacheKey = getSessionCacheKey(tokenHash);
    if (userId !== undefined) {
      const entry = await app.cache.get<CacheSessionPayload>(cacheKey);
      if (!entry || entry.userId !== String(userId)) {
        return false;
      }
    }
    await app.cache.delete(cacheKey);
    return true;
  }

  if (userId !== undefined) {
    const res = await app.db.query(
      `DELETE FROM "${SESSION_TABLE_NAME}" WHERE "token_hash" = $1 AND "user_id" = $2;`,
      [tokenHash, String(userId)],
    );
    return res.changes > 0;
  }

  const res = await app.db.query(
    `DELETE FROM "${SESSION_TABLE_NAME}" WHERE "token_hash" = $1;`,
    [tokenHash],
  );
  return res.changes > 0;
}

/**
 * Delete all DB-backed sessions for a user (used when a user deletes their account).
 */
export async function revokeAllUserSessions(
  app: Pick<FastifyInstance, 'db'>,
  config: ResolvedAppConfig,
  userId: unknown,
): Promise<void> {
  if (
    !config.authentication.enabled ||
    config.authentication.sessionStorage !== 'db'
  ) {
    return;
  }

  await app.db.query(
    `DELETE FROM "${SESSION_TABLE_NAME}" WHERE "user_id" = $1;`,
    [String(userId)],
  );
}
