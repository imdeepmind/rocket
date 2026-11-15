# Health Check Example

This example demonstrates how to configure and verify ROSS's built-in health check route (`application.healthCheck`).

Production services and orchestrators (such as Kubernetes readiness/liveness probes, AWS ALB health checks, and uptime monitors) need a reliable endpoint to verify that the HTTP server, database connection, and cache are healthy and operational.

## Configuration

[`healthcheck_config.json`](./healthcheck_config.json):

```json
{
  "application": {
    "name": "Health Check Example API",
    "healthCheck": {
      "enabled": true,
      "path": "/api/health"
    }
  }
}
```

### Key Options

- `enabled`: Set to `true` to register the health check route (defaults to `true` if omitted).
- `path`: URL path for the health check endpoint (defaults to `/api/health`). You can customize this to `/healthz`, `/status`, or any preferred path.

### Built-in Probes

When invoked, the health check route verifies:
1. **Database Probe**: Executes a minimal `SELECT 1;` query against the configured database engine (SQLite, PostgreSQL, or MySQL) and reports query latency in milliseconds (`latencyMs`).
2. **Cache Probe**: Verifies connectivity with the cache backend (Redis `ping()` or read/write probe on in-memory `NodeCache`).

### Security & Middleware Isolation

- **Bypasses Authentication**: The health check endpoint does not require JWT, API key, or session tokens so monitoring agents can poll it directly.
- **Bypasses SSP**: Server-Side Parameters (SSP) enforcement does not apply to the health check.
- **Exempt from Rate Limiting by Default**: Unless `application.rateLimit.rateLimitHealthAPI` is explicitly set to `true`, high-frequency health probes are not blocked by rate limiting.

## Running the Example

```bash
ross dev -c healthcheck_config.json
```

## Verification with curl

### 1. Check Healthy Status (HTTP 200 OK)

Query the health check route:

```bash
curl -i http://localhost:3000/api/health
```

Expected response:
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "ok",
  "timestamp": "2026-11-15T15:30:00.000Z",
  "services": {
    "database": {
      "status": "up",
      "latencyMs": 1
    },
    "cache": {
      "status": "up"
    }
  }
}
```

### 2. Degraded Status (HTTP 503 Service Unavailable)

If any required service (such as the database connection) is unreachable or fails the query probe, ROSS immediately returns `503 Service Unavailable` with details about the degraded service:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json; charset=utf-8

{
  "status": "degraded",
  "timestamp": "2026-11-15T15:30:00.000Z",
  "services": {
    "database": {
      "status": "down",
      "error": "Database service is unavailable"
    },
    "cache": {
      "status": "up"
    }
  }
}
```

