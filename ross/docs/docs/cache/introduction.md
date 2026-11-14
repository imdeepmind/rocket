---
sidebar_position: 1
---

# Introduction

ROSS uses a cache layer for short-lived application data. The framework itself uses the configured cache for:

- OTP codes used by login MFA, registration verification, password reset, and email changes
- Rate-limit counters
- Health-check probes
- Custom caching logic in custom function endpoints through `app.cache`

The cache is configured under `infrastructure.cache`. The section is optional; when it is omitted, ROSS uses an in-memory cache.

## Supported engines

| Engine | Identifier | Visibility | Best for |
| --- | --- | --- | --- |
| [In-memory](./memory.md) | `"memory"` | Per process | Local development, tests, single-instance deployments |
| [Redis](./redis.md) | `"redis"` | Shared across instances | Multi-instance deployments and shared OTP/rate-limit state |
| [Memcached](./memcache.md) | `"memcached"` | Shared across instances | Multi-instance deployments using a lightweight key/value cache |

## Configuration

```json
{
  "infrastructure": {
    "database": {
      "engine": "sqlite",
      "connection": { "url": "./database.db" }
    },
    "cache": {
      "engine": "memcached",
      "connection": { "url": "localhost:11211" },
      "timeout": 5000
    }
  }
}
```

The `timeout` field is expressed in milliseconds and defaults to `10000`. It is used as the connection timeout for Redis and Memcached.

## Startup behavior

When ROSS starts, it creates the configured cache client and immediately calls `ping()`. If the cache cannot be reached, startup fails with the underlying connection error. This prevents the server from accepting traffic while its cache-backed features are unavailable.

## The `app.cache` API

Every cache engine exposes the same interface, so switching engines does not require application code changes.

| Method | Description |
| --- | --- |
| `get<T>(key)` | Returns the cached value, or `null` when the key is missing or expired. |
| `set(key, value, ttlSeconds?)` | Stores a value. When `ttlSeconds` is omitted, the entry does not expire. |
| `delete(key)` | Removes a key. |
| `has(key)` | Returns `true` when the key exists. |
| `clear()` | Removes all entries from the configured cache. |
| `ping()` | Verifies that the cache backend is reachable. |
| `close()` | Closes the underlying client. ROSS calls this automatically on shutdown. |
| `raw` | The underlying client instance for engine-specific operations. |

```typescript
const cached = await app.cache.get<{count: number}>('dashboard_task_count');

if (cached === null) {
  const result = await app.db.query('SELECT count(*) AS count FROM tasks');
  await app.cache.set('dashboard_task_count', result.rows[0], 60);
}
```

Values are serialized as JSON, so objects, arrays, numbers, booleans, and strings round-trip consistently across all engines. Use `null`-safe checks because a cache miss also returns `null`.

### Using the cache from custom functions

[Custom function endpoints](../custom-endpoints/function.md) receive the Fastify instance as their second argument, so they can use the same cache layer without engine-specific code:

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function getDashboardStats(
  _request: FastifyRequest,
  app: FastifyInstance,
) {
  const cacheKey = 'dashboard:task-count';
  const cached = await app.cache.get<number>(cacheKey);

  if (cached !== null) {
    return {fromCache: true, count: cached};
  }

  const result = await app.db.query('SELECT count(*) AS count FROM tasks');
  const count = Number(result.rows[0]?.count ?? 0);

  await app.cache.set(cacheKey, count, 60);

  return {fromCache: false, count};
}
```

The first call is a cache miss and queries the database. Subsequent calls within 60 seconds return the cached count. Use `delete(cacheKey)` when a write invalidates the value, or `clear()` to flush the configured cache.

Cache entries are shared between server instances only when Redis or Memcached is configured. With the default in-memory engine, each process has its own cache.

## Choosing an engine

- Use **in-memory** for local development, automated tests, and single-instance deployments.
- Use **Redis** or **Memcached** when multiple server instances must share OTP codes, rate-limit counters, or cached data.

:::warning[OTPs in multi-instance deployments]

The in-memory engine is process-local. OTPs are not shared between instances and are lost when the process restarts. If authentication uses MFA or account verification, configure Redis or Memcached in any multi-instance deployment.

:::

## Health checks

When the health-check route is enabled, ROSS probes the cache with `ping()` alongside the database query. A cache failure is reported as `"cache": { "status": "down" }` and the endpoint returns `503 Service Unavailable`. See [Application Configuration](../application.md#healthcheck) for the response format.
