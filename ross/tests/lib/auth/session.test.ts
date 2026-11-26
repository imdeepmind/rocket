import {describe, expect, test, vi} from 'vitest';

import {
  createSession,
  getSessionModelConfig,
  revokeAllUserSessions,
  revokeSession,
  rotateSession,
  SESSION_TABLE_NAME,
} from '@/lib/auth/session';

import {sha256} from '@/utils/hash';

import {
  buildEnabledAuth,
  upAuthAuthentication,
} from '@tests/helpers/auth-config';

function createMockCache() {
  const store = new Map<string, {value: unknown; ttl?: number}>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: unknown, ttl?: number) => {
      store.set(key, {value, ttl});
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    has: vi.fn(async (key: string) => store.has(key)),
    clear: vi.fn(async () => store.clear()),
    ping: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    raw: null,
  };
}

function createMockDb() {
  const rows = new Map<
    string,
    {
      id: string;
      user_id: string;
      token_hash: string;
      expires_at: string;
      created_at: string;
    }
  >();

  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('INSERT INTO "_ross_sessions"')) {
      const [id, user_id, token_hash, expires_at, created_at] =
        params as string[];
      rows.set(token_hash, {id, user_id, token_hash, expires_at, created_at});
      return {changes: 1, rows: []};
    }

    if (sql.startsWith('SELECT "id", "user_id", "expires_at"')) {
      const [token_hash] = params as string[];
      const row = rows.get(token_hash);
      return {changes: 0, rows: row ? [row] : []};
    }

    if (
      sql.startsWith(
        'DELETE FROM "_ross_sessions" WHERE "token_hash" = $1 AND "user_id" = $2',
      )
    ) {
      const [token_hash, user_id] = params as string[];
      const row = rows.get(token_hash);
      if (row && row.user_id === user_id) {
        rows.delete(token_hash);
        return {changes: 1, rows: []};
      }
      return {changes: 0, rows: []};
    }

    if (
      sql.startsWith('DELETE FROM "_ross_sessions" WHERE "token_hash" = $1')
    ) {
      const [token_hash] = params as string[];
      const existed = rows.delete(token_hash);
      return {changes: existed ? 1 : 0, rows: []};
    }

    if (sql.startsWith('DELETE FROM "_ross_sessions" WHERE "user_id" = $1')) {
      const [user_id] = params as string[];
      let count = 0;
      for (const [k, v] of rows.entries()) {
        if (v.user_id === user_id) {
          rows.delete(k);
          count++;
        }
      }
      return {changes: count, rows: []};
    }

    return {changes: 0, rows: []};
  });

  return {
    rows,
    query,
    beginTransaction: vi.fn(async () => ({
      query,
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
    })),
    close: vi.fn(async () => {}),
  };
}

describe('session management', () => {
  test('getSessionModelConfig defines _ross_sessions schema', () => {
    const model = getSessionModelConfig();
    expect(SESSION_TABLE_NAME).toBe('_ross_sessions');
    expect(model.fields.id.primaryKey).toBe(true);
    expect(model.fields.token_hash.unique).toBe(true);
    expect(model.fields.user_id.nullable).toBe(false);
    expect(model.indexes.idx_ross_sessions_user_id.fields).toEqual(['user_id']);
  });

  test('db backend: create, rotate, and revoke sessions', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    const issued = await createSession({db, cache} as never, config, 42);
    expect(issued.refreshToken).toBeTruthy();
    expect(db.rows.size).toBe(1);
    expect(db.rows.has(sha256(issued.refreshToken))).toBe(true);

    const rotated = await rotateSession(
      {db, cache} as never,
      config,
      issued.refreshToken,
    );
    expect(rotated).not.toBeNull();
    expect(rotated?.userId).toBe('42');
    expect(rotated?.refreshToken).not.toBe(issued.refreshToken);

    // Old token cannot be reused
    const replay = await rotateSession(
      {db, cache} as never,
      config,
      issued.refreshToken,
    );
    expect(replay).toBeNull();

    // Wrong user cannot revoke
    await expect(
      revokeSession({db, cache} as never, config, rotated!.refreshToken, 99),
    ).resolves.toBe(false);

    // Owner can revoke
    await expect(
      revokeSession({db, cache} as never, config, rotated!.refreshToken, 42),
    ).resolves.toBe(true);
    expect(db.rows.size).toBe(0);
  });

  test('db backend: rejects expired session and cleans it up', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    const issued = await createSession({db, cache} as never, config, 7);
    const entry = db.rows.get(sha256(issued.refreshToken))!;
    entry.expires_at = new Date(Date.now() - 1000).toISOString();

    const rotated = await rotateSession(
      {db, cache} as never,
      config,
      issued.refreshToken,
    );
    expect(rotated).toBeNull();
    expect(db.rows.size).toBe(0);
  });

  test('db backend: revokeAllUserSessions removes all sessions for user', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    await createSession({db, cache} as never, config, 1);
    await createSession({db, cache} as never, config, 1);
    await createSession({db, cache} as never, config, 2);
    expect(db.rows.size).toBe(3);

    await revokeAllUserSessions({db} as never, config, 1);
    expect(db.rows.size).toBe(1);
  });

  test('cache backend: create, rotate, and revoke sessions with TTL', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);
    if (config.authentication.enabled) {
      config.authentication.sessionStorage = 'cache';
      config.authentication.refreshTokenExpiration = '2h';
    }

    const issued = await createSession({db, cache} as never, config, 42);
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('session:refresh:'),
      expect.objectContaining({userId: '42'}),
      7200,
    );

    const rotated = await rotateSession(
      {db, cache} as never,
      config,
      issued.refreshToken,
    );
    expect(rotated?.userId).toBe('42');
    expect(rotated?.refreshToken).not.toBe(issued.refreshToken);

    // Old token rejected
    await expect(
      rotateSession({db, cache} as never, config, issued.refreshToken),
    ).resolves.toBeNull();

    // Wrong user cannot revoke
    await expect(
      revokeSession({db, cache} as never, config, rotated!.refreshToken, 99),
    ).resolves.toBe(false);

    // Owner can revoke
    await expect(
      revokeSession({db, cache} as never, config, rotated!.refreshToken, 42),
    ).resolves.toBe(true);
    expect(cache.store.size).toBe(0);
  });

  test('returns null for missing or empty refresh token', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    await expect(
      rotateSession({db, cache} as never, config, ''),
    ).resolves.toBeNull();
    await expect(revokeSession({db, cache} as never, config, '')).resolves.toBe(
      false,
    );
  });

  test('throws when authentication is disabled', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const disabled = buildEnabledAuth([]);

    await expect(
      createSession({db, cache} as never, disabled, 1),
    ).rejects.toThrow('Authentication is not enabled');
  });

  test('cache backend: rejects expired session and cleans it up', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);
    if (config.authentication.enabled) {
      config.authentication.sessionStorage = 'cache';
    }

    const issued = await createSession({db, cache} as never, config, 7);
    const key = `session:refresh:${sha256(issued.refreshToken)}`;
    const entry = cache.store.get(key)!.value as {
      sessionId: string;
      userId: string;
      expiresAt: string;
    };
    entry.expiresAt = new Date(Date.now() - 1000).toISOString();

    await expect(
      rotateSession({db, cache} as never, config, issued.refreshToken),
    ).resolves.toBeNull();
    expect(cache.store.size).toBe(0);
  });

  test('revokeSession without userId deletes in both db and cache', async () => {
    const db = createMockDb();
    const cache = createMockCache();
    const dbConfig = buildEnabledAuth([upAuthAuthentication.providers[0]]);
    const issuedDb = await createSession({db, cache} as never, dbConfig, 1);
    await expect(
      revokeSession({db, cache} as never, dbConfig, issuedDb.refreshToken),
    ).resolves.toBe(true);
    expect(db.rows.size).toBe(0);

    const cacheConfig = buildEnabledAuth([upAuthAuthentication.providers[0]]);
    if (cacheConfig.authentication.enabled) {
      cacheConfig.authentication.sessionStorage = 'cache';
    }
    const issuedCache = await createSession(
      {db, cache} as never,
      cacheConfig,
      1,
    );
    await expect(
      revokeSession(
        {db, cache} as never,
        cacheConfig,
        issuedCache.refreshToken,
      ),
    ).resolves.toBe(true);
    expect(cache.store.size).toBe(0);
  });

  test('revokeAllUserSessions is a no-op when sessionStorage is cache', async () => {
    const db = createMockDb();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);
    if (config.authentication.enabled) {
      config.authentication.sessionStorage = 'cache';
    }

    await revokeAllUserSessions({db} as never, config, 1);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('db backend: rolls back transaction when query throws during rotation', async () => {
    const rollback = vi.fn().mockRejectedValueOnce(new Error('rollback err'));
    const release = vi.fn();
    const db = {
      query: vi.fn(),
      beginTransaction: vi.fn(async () => ({
        query: vi.fn().mockRejectedValueOnce(new Error('DB failure')),
        commit: vi.fn(async () => {}),
        rollback,
        release,
      })),
    };
    const cache = createMockCache();
    const config = buildEnabledAuth([upAuthAuthentication.providers[0]]);

    await expect(
      rotateSession({db, cache} as never, config, 'some-token'),
    ).rejects.toThrow('DB failure');
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
