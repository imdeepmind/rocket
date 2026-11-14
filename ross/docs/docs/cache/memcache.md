---
sidebar_position: 4
---

# Memcached Cache

Memcached is a shared, high-performance key/value cache. ROSS connects to Memcached with [`memjs`](https://github.com/memcachier/memjs) and uses it for OTPs, rate-limit counters, health checks, and custom cached values across all server instances.

## Configuration

```json
{
  "infrastructure": {
    "cache": {
      "engine": "memcached",
      "connection": {
        "url": "localhost:11211"
      },
      "timeout": 5000
    }
  }
}
```

| Field | Required | Description |
| --- | --- | --- |
| `engine` | **Yes** | Must be `"memcached"`. |
| `connection.url` | **Yes** | One or more Memcached servers in `host:port` format. |
| `timeout` | No | Connection timeout in milliseconds. Defaults to `10000`. Internally converted to seconds for `memjs`. |

### Accepted URL formats

```text
localhost:11211
memcached://localhost:11211
cache-1.internal:11211,cache-2.internal:11211
```

The optional `memcached://` scheme is accepted and removed before the client is created. Multiple servers can be supplied as a comma-separated list. Ports must be between `1` and `65535`.

### Environment variables

```json
{
  "connection": {
    "url": "env:MEMCACHE_SERVERS"
  }
}
```

Set `MEMCACHE_SERVERS` to a comma-separated list such as `cache-1:11211,cache-2:11211`.

## Characteristics

- **Shared**: all server instances connected to the same Memcached servers see the same entries.
- **Volatile**: Memcached does not persist data to disk. Entries can also be evicted when memory is full.
- **Network dependency**: ROSS pings Memcached at startup and fails to start if the connection cannot be established.
- **Size limits**: Memcached keys are limited to 250 bytes and values to 1 MB by default.

## Behavior

```typescript
await app.cache.set('feature-flags', { beta: true }, 300);
const flags = await app.cache.get<{ beta: boolean }>('feature-flags');

await app.cache.delete('feature-flags');
await app.cache.has('feature-flags'); // false
```

`clear()` flushes the connected Memcached servers. Use it carefully if the instances are shared with other applications.

## When to use it

Use Memcached when:

- You run more than one server instance.
- You want a lightweight shared cache without Redis persistence features.
- You already operate Memcached infrastructure.

Redis may be a better fit when you need persistence, richer data structures, or a managed Redis service. See [Redis](./redis.md).
