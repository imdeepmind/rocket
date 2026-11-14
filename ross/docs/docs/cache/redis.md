---
sidebar_position: 3
---

# Redis Cache

Redis is a shared, network-accessible cache. ROSS connects to Redis with [`ioredis`](https://github.com/redis/ioredis) and uses it for OTPs, rate-limit counters, health checks, and custom cached values across all server instances.

## Configuration

```json
{
  "infrastructure": {
    "cache": {
      "engine": "redis",
      "connection": {
        "url": "redis://localhost:6379"
      },
      "timeout": 5000
    }
  }
}
```

| Field | Required | Description |
| --- | --- | --- |
| `engine` | **Yes** | Must be `"redis"`. |
| `connection.url` | **Yes** | Redis connection URL. Must start with `redis://`. |
| `timeout` | No | Connection timeout in milliseconds. Defaults to `10000`. |

### URLs with credentials

```json
{
  "connection": {
    "url": "redis://:super-secret-password@redis.internal:6379"
  }
}
```

Prefer environment variable substitution for credentials:

```json
{
  "connection": {
    "url": "env:REDIS_URL"
  }
}
```

Set `REDIS_URL` to the full connection URL before starting the server.

## Characteristics

- **Shared**: all server instances connected to the same Redis database see the same entries.
- **Persistent across restarts** (subject to your Redis persistence configuration).
- **Network dependency**: ROSS pings Redis at startup and fails to start if the connection cannot be established.

## Behavior

```typescript
await app.cache.set('session:abc', { userId: 42 }, 900);
const session = await app.cache.get<{ userId: number }>('session:abc');

await app.cache.delete('session:abc');
await app.cache.has('session:abc'); // false
```

`clear()` runs `FLUSHDB` against the connected Redis database. Use it carefully if the database is shared with other applications.

## When to use it

Use Redis when:

- You run more than one server instance.
- OTPs must be shared between instances.
- Rate-limit counters must be enforced globally.
- You already operate Redis infrastructure.

For a lightweight alternative with similar multi-instance behavior, see [Memcached](./memcache.md).
