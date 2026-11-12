---
sidebar_position: 4
---

# Application Configuration

The `application` block is the core configuration section in `ross.json` (or `config.json`). It controls server runtime behavior, application identity, logging verbosity, security policies (CORS and rate limiting), API versioning, health checks, and server-side variable injection.

Every project built with ROSS requires an `application` block with at least a `name`. All other operational settings have secure, production-ready defaults that you can customize.

## Example Configuration

```json
{
  "application": {
    "name": "E-Commerce API",
    "logLevel": "info",
    "dangerouslyOverrideDefaultVariant": "v1",
    "rateLimit": {
      "enabled": true,
      "max": 1000,
      "timeWindow": "15m"
    },
    "cors": {
      "enabled": true,
      "origins": ["https://app.example.com", "http://localhost:5173"],
      "methods": ["GET", "POST", "PATCH", "PUT", "DELETE"],
      "allowedHeaders": ["Authorization", "Content-Type"],
      "exposedHeaders": ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"],
      "credentials": true,
      "maxAge": 86400,
      "routes": ["/api/*"]
    },
    "magicVariables": {
      "defaultOrg": "acme-corp",
      "systemTenant": 101
    },
    "healthCheck": {
      "enabled": true,
      "path": "/health"
    }
  }
}
```

## Fields Reference

### `name`

- **Type**: `string`
- **Required**: **Yes** (`minLength: 1`)
- **Default**: *None (must be specified)*

The human-readable display name of your application.

#### What it does

- Displayed prominently in the terminal welcome banner when you start the server using `ross dev` or `ross start`.
- Serves as the fallback title for your OpenAPI/Swagger interactive documentation (`docs.openapi.info.title`) if an explicit title is not provided in the `docs` configuration block.

```json
{
  "application": {
    "name": "Acme Inventory Service"
  }
}
```

### `logLevel`

- **Type**: `string`
- **Required**: No
- **Default**: `"info"`
- **Allowed values**: `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"`, `"silent"`

Controls the verbosity of Fastify's structured JSON logger during server execution.

#### Log levels explained

- **`"trace"`**: Highly granular internal framework diagnostics and low-level socket activity.
- **`"debug"`**: Diagnostic information, including SQL query execution, cache hits/misses, and internal route resolution.
- **`"info"`** *(default)*: Normal runtime events: server startup, route bindings, incoming HTTP requests, and completed responses with HTTP status codes and response times.
- **`"warn"`**: Non-critical issues such as rate-limit triggers, deprecation warnings, or recoverable errors.
- **`"error"`**: Request processing failures, database exceptions, and unhandled 500 errors.
- **`"fatal"`**: Critical system errors that force the server process to abort.
- **`"silent"`**: Suppresses all log output completely.

```json
{
  "application": {
    "name": "My API",
    "logLevel": "debug"
  }
}
```

> **Tip**: You can temporarily override `logLevel` in your terminal without modifying your config by passing the `--verbose` flag (e.g., `ross dev --verbose` or `ross start --verbose`), which forces the log level to `"debug"`.

### `dangerouslyOverrideDefaultVariant`

- **Type**: `string`
- **Required**: No
- **Default**: `"v1"`
- **Validation**: 1–25 characters, alphanumeric, hyphens, and underscores (`^[a-zA-Z0-9_-]+$`)

Sets the default API versioning variant used for route registration and API identifier resolution.

#### What it does

By default, ROSS prefixes auto-generated REST endpoints with `/api/v1/` (e.g., `/api/v1/users`, `/api/v1/tasks`) and registers internal API identifiers as `model:v1:<model>:<field>:<operation>`.

Setting `dangerouslyOverrideDefaultVariant` replaces the `v1` segment with your custom variant identifier across all generated endpoints:

```json
{
  "application": {
    "name": "My API",
    "dangerouslyOverrideDefaultVariant": "v2"
  }
}
```

With the above setting, your generated endpoints become:

- `http://localhost:3000/api/v2/users`
- `http://localhost:3000/api/v2/tasks`

> **Warning**: This field is prefixed with `dangerously` because changing it modifies the URL structure and API identifiers across your entire application. Existing API consumers and frontend clients expecting `/api/v1/` endpoints will break.

### `rateLimit`

- **Type**: `object`
- **Required**: No
- **Default**:

  ```json
  {
    "enabled": false,
    "max": 100,
    "timeWindow": "1m"
  }
  ```

Protects your server against denial-of-service (DoS) attacks, brute-force attempts, and runaway client loops by enforcing rolling request limits per IP address.

Rate limiting is integrated with ROSS's caching layer (`infrastructure.cache`). When using a distributed cache engine, limits are tracked centrally across multiple server instances. When using in-memory cache, limits are tracked locally per process.

#### Sub-fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | **Yes** (if `rateLimit` is defined) | `false` | Enables or disables rate limiting globally. |
| `max` | `integer` | **Yes** (if `rateLimit` is defined) | `100` | Maximum number of requests allowed within the time window (`minimum: 1`). |
| `timeWindow` | `string` | **Yes** (if `rateLimit` is defined) | `"1m"` | Rolling time duration window. Must match `^\d+[smhd]$`. |

#### Supported Time Window Units

- `s`: Seconds (e.g., `"30s"`, `"60s"`)
- `m`: Minutes (e.g., `"1m"`, `"15m"`)
- `h`: Hours (e.g., `"1h"`, `"24h"`)
- `d`: Days (e.g., `"1d"`, `"7d"`)

#### Response Headers

When rate limiting is enabled, ROSS automatically attaches the standard rate-limit headers to HTTP responses:

- `x-ratelimit-limit`: The maximum allowed requests in the current window.
- `x-ratelimit-remaining`: The number of requests remaining before reaching the limit.
- `x-ratelimit-reset`: Milliseconds until the current rate limit window resets.

#### Rate Limit Exceeded

When a client exceeds the configured `max` threshold, ROSS immediately halts the request and responds with:

- **HTTP Status**: `429 Too Many Requests`
- **Payload**:

  ```json
  {
    "statusCode": 429,
    "error": "Too Many Requests",
    "message": "Rate limit exceeded, retry in 42 seconds"
  }
  ```

> **Note**: Health check endpoints (`/api/health`) are automatically exempt from rate limiting so external load balancers and uptime monitors are never blocked.

### `cors`

- **Type**: `object`
- **Required**: No
- **Default**:

  ```json
  {
    "enabled": false,
    "origins": [],
    "methods": ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    "allowedHeaders": ["Content-Type", "Authorization"],
    "exposedHeaders": [],
    "credentials": false,
    "maxAge": 86400,
    "routes": []
  }
  ```

Configures Cross-Origin Resource Sharing (CORS) rules to regulate how web browsers access your API from different domains or ports.

#### Sub-fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | **Yes** (if `cors` is defined) | `false` | Enables or disables CORS handling. |
| `origins` | `string[]` | No | `[]` | List of allowed origin URLs or `["*"]` for public APIs. |
| `methods` | `string[]` | No | `["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]` | Allowed HTTP methods for cross-origin requests. Allowed: `GET`, `HEAD`, `PUT`, `PATCH`, `POST`, `DELETE`. |
| `allowedHeaders` | `string[]` | No | `["Content-Type", "Authorization"]` | Headers allowed in cross-origin requests (`Access-Control-Allow-Headers`). |
| `exposedHeaders` | `string[]` | No | `[]` | Headers exposed to client-side JavaScript (`Access-Control-Expose-Headers`). |
| `credentials` | `boolean` | No | `false` | Whether to allow cookies, authorization headers, or TLS client certificates (`Access-Control-Allow-Credentials`). |
| `maxAge` | `integer` | No | `86400` | Preflight cache lifetime in seconds (`Access-Control-Max-Age`). Defaults to 24 hours. |
| `routes` | `string[]` | No | `[]` | Glob patterns specifying which route paths enforce CORS. Empty means all routes. |

#### Route Scoping with Glob Patterns

The `routes` property accepts glob patterns (evaluated using `picomatch`) to restrict CORS headers to specific URL subpaths:

```json
{
  "application": {
    "cors": {
      "enabled": true,
      "origins": ["https://myfrontend.com"],
      "routes": ["/api/v1/public/*", "/api/v1/auth/*"]
    }
  }
}
```

If `routes` is omitted or empty, CORS policies are applied globally across all endpoints.

#### Critical Security Constraint: Wildcards and Credentials

Per the official W3C / WHATWG CORS security specification, **credentials cannot be enabled for wildcard origins**.

ROSS enforces this rule during configuration validation:

- If `origins` contains `"*"`, `credentials` **must be `false`**.
- If `credentials: true` and `origins` contains `"*"`, `ross check` will fail with:

  ```text
  application.cors: credentials cannot be true when origins includes "*"
  ```

### `magicVariables`

- **Type**: `object` (`Record<string, string | number | boolean>`)
- **Required**: No
- **Default**: `{}`

Defines application-wide constants that can be referenced inside model API configurations using Server-Side Parameters (`serverSideParams`).

#### How it works

When defining model APIs in your `ross.json`, you can define Server-Side Parameters to automatically inject trusted, tamper-proof values into incoming requests (`query`, `body`, or `path` parameters) before the database query executes.

You reference a magic variable in your API configuration using double brackets: `[[variableName]]`.

#### 1. Define variables in `application.magicVariables`

```json
{
  "application": {
    "name": "SaaS Platform",
    "magicVariables": {
      "defaultOrg": "acme-corp",
      "systemTenantId": 42,
      "defaultRegion": "us-east-1"
    }
  }
}
```

#### 2. Reference them in your model API `serverSideParams`

```json
{
  "apis": {
    "model:v1:projects:post:index": {
      "serverSideParams": [
        {
          "name": "orgId",
          "type": "body",
          "value": "[[defaultOrg]]"
        },
        {
          "name": "tenantId",
          "type": "body",
          "value": "[[systemTenantId]]"
        }
      ]
    }
  }
}
```

When a user calls `POST /api/v1/projects`, ROSS strips `orgId` and `tenantId` from client validation, automatically injects `"orgId": "acme-corp"` and `"tenantId": 42` into the request body on the server side, and saves them to the database. The client cannot spoof or override these fields.

#### Built-in vs. Custom Magic Variables

ROSS includes built-in magic variables derived from the authenticated session:

- `[[userId]]`: Resolves to the authenticated user's ID (`request.user.id`).
- `[[userEmail]]`: Resolves to the authenticated user's email (`request.user.email`).

If a variable defined in `application.magicVariables` has the same name as a built-in variable, your custom value in `application.magicVariables` takes precedence.

### `healthCheck`

- **Type**: `object`
- **Required**: No
- **Default**:

  ```json
  {
    "enabled": true,
    "path": "/health"
  }
  ```

Configures an automated health monitoring endpoint that probes the operational readiness of your server, database connection, and cache service. It is designed for AWS ALB / NLB target group health checks, Kubernetes liveness and readiness probes, Docker health checks, and third-party monitoring services (such as Datadog or UptimeRobot).

#### Sub-fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | No | `true` | Enables or disables the health check route. |
| `path` | `string` | No | `"/health"` | The URL path for the health check. Must start with `/` or will be prefixed with `/`. |

#### Path Normalization

ROSS registers health check routes under the `/api` prefix. The `path` field is automatically normalized:

- `"path": "/health"` $\rightarrow$ accessible at `/api/health`
- `"path": "/api/health"` $\rightarrow$ accessible at `/api/health`
- `"path": "/status"` $\rightarrow$ accessible at `/api/status`

#### Probed Services

When a request is made to the health endpoint, ROSS performs real-time health checks:

1. **Database Probe**: Executes a lightweight query (`SELECT 1`) against the active database (PostgreSQL or SQLite) and records round-trip latency in milliseconds.
2. **Cache Probe**: Pings the configured cache engine.

#### Response Status Codes & Payloads

##### All Services Operational (`200 OK`)

```bash
curl http://localhost:3000/api/health
```

```json
{
  "status": "ok",
  "timestamp": "2026-11-12T17:15:30.123Z",
  "services": {
    "database": {
      "status": "up",
      "latencyMs": 1.42
    },
    "cache": {
      "status": "up"
    }
  }
}
```

##### Service Degraded or Unreachable (`503 Service Unavailable`)

If the database connection drops or the cache service becomes unreachable:

```json
{
  "status": "degraded",
  "timestamp": "2026-11-12T17:15:30.123Z",
  "services": {
    "database": {
      "status": "down",
      "error": "Connection to database failed: ECONNREFUSED"
    },
    "cache": {
      "status": "up"
    }
  }
}
```

> **Note**: Health check routes are automatically exempted from rate limiting to prevent load balancer probes from being rejected.

## Environment Variable Substitution

ROSS supports dynamic environment variable resolution using the `"env:VARIABLE_NAME"` syntax anywhere in your JSON configuration values. This is particularly useful for separating environment-specific secrets and settings from source control.

You can use environment substitution inside the `application` block:

```json
{
  "application": {
    "name": "env:APP_NAME",
    "logLevel": "env:LOG_LEVEL",
    "magicVariables": {
      "masterTenant": "env:DEFAULT_TENANT_ID"
    }
  }
}
```

If the referenced environment variable is not defined when the server starts, ROSS will throw an informative startup error specifying the missing variable.

## Complete Summary Table

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `name` | `string` | **Yes** | — | Min length: 1. Used in terminal banner and OpenAPI fallback. |
| `logLevel` | `string` | No | `"info"` | `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"`, `"silent"`. |
| `dangerouslyOverrideDefaultVariant` | `string` | No | `"v1"` | Pattern: `^[a-zA-Z0-9_-]+$`. Changes base URL version segment. |
| `rateLimit` | `object` | No | See defaults | Protects against DoS / brute force. |
| `rateLimit.enabled` | `boolean` | **Yes\*** | `false` | Required if `rateLimit` object is present. |
| `rateLimit.max` | `integer` | **Yes\*** | `100` | Minimum: 1. Max requests allowed per window. |
| `rateLimit.timeWindow` | `string` | **Yes\*** | `"1m"` | Format: `^\d+[smhd]$` (e.g., `"15m"`, `"1h"`). |
| `cors` | `object` | No | See defaults | Configures cross-origin access policies. |
| `cors.enabled` | `boolean` | **Yes\*** | `false` | Required if `cors` object is present. |
| `cors.origins` | `string[]` | No | `[]` | Allowed domains. Cannot contain `*` if `credentials: true`. |
| `cors.methods` | `string[]` | No | `["GET", ...]` | Allowed HTTP verbs. |
| `cors.allowedHeaders` | `string[]` | No | `["Content-Type", ...]` | Allowed request headers. |
| `cors.exposedHeaders` | `string[]` | No | `[]` | Headers readable by the browser client. |
| `cors.credentials` | `boolean` | No | `false` | Allows cookies/auth headers across origins. |
| `cors.maxAge` | `integer` | No | `86400` | Preflight cache TTL in seconds. |
| `cors.routes` | `string[]` | No | `[]` | Glob patterns to limit CORS to specific paths. |
| `magicVariables` | `object` | No | `{}` | Key-value pairs for `[[varName]]` server-side parameter injection. |
| `healthCheck` | `object` | No | See defaults | Automated database and cache health probe. |
| `healthCheck.enabled` | `boolean` | No | `true` | Set to `false` to disable. |
| `healthCheck.path` | `string` | No | `"/health"` | Normalized under `/api`. Exempt from rate limiting. |

*\* Indicates the property is required when the parent object (`rateLimit` or `cors`) is defined.*

## Recipes

### Minimal Development Configuration

For local development with SQLite and fast iteration:

```json
{
  "application": {
    "name": "Blog API",
    "logLevel": "debug"
  }
}
```

- Health checks are enabled by default at `http://localhost:3000/api/health`.
- Rate limiting and CORS are disabled for zero-friction local testing.
- Logs display debug statements.

### Production-Hardened Configuration

A hardened configuration for production environments behind an ingress or CDN:

```json
{
  "application": {
    "name": "Production Storefront API",
    "logLevel": "info",
    "rateLimit": {
      "enabled": true,
      "max": 500,
      "timeWindow": "15m"
    },
    "cors": {
      "enabled": true,
      "origins": [
        "https://storefront.example.com",
        "https://admin.example.com"
      ],
      "methods": ["GET", "POST", "PUT", "PATCH", "DELETE"],
      "allowedHeaders": ["Authorization", "Content-Type", "x-client-version"],
      "exposedHeaders": ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"],
      "credentials": true,
      "maxAge": 86400,
      "routes": ["/api/*"]
    },
    "magicVariables": {
      "defaultOrg": "acme-corp"
    },
    "healthCheck": {
      "enabled": true,
      "path": "/health"
    }
  }
}
```
