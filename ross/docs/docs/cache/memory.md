---
sidebar_position: 2
---

# In-Memory Cache

The in-memory engine is ROSS's default cache backend. It is implemented with [`node-cache`](https://www.npmjs.com/package/node-cache) and stores entries inside the Node.js process.

## Configuration

The in-memory engine has no connection settings:

```json
{
  "infrastructure": {
    "cache": {
      "engine": "memory"
    }
  }
}
```

Omitting `infrastructure.cache` has the same effect.

## Characteristics

- **Process-local**: every server instance has its own cache. Entries are not shared between processes.
- **Volatile**: all entries are lost when the process exits or restarts.
- **No network dependency**: there is nothing to connect to, so startup cannot fail because of the cache.
- **Zero extra infrastructure**: useful for local development, automated tests, and single-instance deployments.

## Behavior

```typescript
await app.cache.set('user:42', { name: 'Ada' }, 60);
const user = await app.cache.get<{ name: string }>('user:42');

await app.cache.delete('user:42');
await app.cache.clear(); // Removes every entry in this process
```

`clear()` flushes all entries in the current process. TTLs are tracked in memory and entries are removed when they expire.

## When to use it

Use the in-memory engine when:

- You are developing locally.
- You are running automated tests.
- Your application runs as a single server instance.

:::warning[Multi-instance deployments]

Do not use the in-memory engine for shared state across multiple instances. OTP codes, rate-limit counters, and custom cached values will differ per process and disappear on restart. Use [Redis](./redis.md) or [Memcached](./memcache.md) instead.

:::
