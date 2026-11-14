---
sidebar_position: 3
---

# Custom Function Endpoints

Custom function endpoints let you execute custom TypeScript or JavaScript business logic when standard database queries are not enough.

They provide direct access to Fastify's request context, database abstractions, cache engine, and application configuration enabling multi-step workflows, external API integrations, cache lifecycle management, and custom validations.

## Configuration Reference

Custom function endpoints are declared in the `customEndpoints` section with `handler.type: "function"`:

```json
{
  "customEndpoints": {
    "<endpointName>": {
      "method": "POST",
      "path": "/projects/:projectId/teams/:teamId/report",
      "description": "Generate custom project team report",
      "validation": { ... },
      "handler": {
        "type": "function",
        "file": "./src/functions/report.ts",
        "exportName": "generateReport",
        "inputs": {
          "path": ["projectId", "teamId"],
          "query": ["format", "includeMetrics"],
          "body": ["title", "threshold"],
          "headers": ["x-client-id"]
        }
      }
    }
  }
}
```

### Endpoint Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `method` | `string` | **Yes** | HTTP method: `"GET"`, `"POST"`, `"PUT"`, `"PATCH"`, or `"DELETE"`. |
| `path` | `string` | **Yes** | Route path (e.g. `/calculate/score/:id`). |
| `description` | `string` | No | Description displayed in OpenAPI/Swagger documentation. |
| `validation` | `object` | No | JSON Schema defining parameter validation rules. |
| `handler` | `object` | **Yes** | Handler configuration object with `type: "function"`. |

### Handler Fields (`type: "function"`)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `"function"` | **Yes** | Must be `"function"`. |
| `file` | `string` | **Yes** | Path to the TypeScript or JavaScript file (relative to project root). |
| `exportName` | `string` | **Yes** | Named export of the handler function. |
| `inputs` | `object` | No | Explicit mapping of inputs forwarded to the handler (`path`, `query`, `body`, `headers`). |

## Function Signature & Parameters

A custom handler function can be asynchronous or synchronous, and accepts two arguments: `request` and `app`.

```typescript
import { FastifyRequest, FastifyInstance } from 'fastify';

export async function myHandler(request: FastifyRequest, app: FastifyInstance) {
  // Business logic here
}
```

### 1. The `request` Object

Provides access to incoming HTTP parameters and user authentication:

- **`request.params`**: Object containing extracted URL path parameters (e.g. `request.params.projectId`).
- **`request.query`**: Object containing extracted URL query parameters (e.g. `request.query.format`).
- **`request.body`**: Object containing the parsed JSON request body (e.g. `request.body.title`).
- **`request.headers`**: Object containing incoming request headers (e.g. `request.headers['x-client-id']`).
- **`request.user`**: Decoded JWT user payload when authentication is enabled (`request.user.id`, `request.user.role`, `request.user.email`).

### 2. The `app` Object

Provides access to ROSS runtime instances and decorators:

- **`app.db.query(sql, params)`**: Uniform database query runner. Returns `{ rows, changes }`.
- **`app.cache`**: Active cache provider (`app.cache.get(key)`, `app.cache.set(key, value, ttlSeconds)`).
- **`app.appConfig`**: The resolved application configuration tree.

## Return Values & Response Format

Any value returned from your handler is automatically wrapped in ROSS's standard response envelope with `HTTP 200`:

```typescript
export async function calculateMetrics(request: any) {
  return {
    score: 95.5,
    status: 'passed'
  };
}
```

Response received by the client:

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "score": 95.5,
    "status": "passed"
  }
}
```

Supported return types include:

- Primitives (`string`, `number`, `boolean`)
- Arrays (`[{ ... }]`)
- Objects (`{ ... }`)
- `null` (mapped to `"data": null`)

## Error Handling & HTTP Status Codes

To return a specific HTTP status code, throw an `Error` and assign the `statusCode` property:

```typescript
export async function findCustomer(request: any, app: any) {
  const customer = await app.db.query(
    'SELECT * FROM customers WHERE id = ?',
    [request.params.id]
  );

  if (customer.rows.length === 0) {
    const error: any = new Error('Customer does not exist');
    error.statusCode = 404;
    throw error;
  }

  return customer.rows[0];
}
```

### Common Status Codes

| Status Code | Usage |
| --- | --- |
| `400` | Input validation or bad request errors. |
| `404` | Entity or resource not found. |
| `409` | Conflict (e.g. duplicate resource state). |
| `422` | Semantic unprocessable entity. |
| `500` | Uncaught exceptions default to HTTP 500 automatically. |

## Build Pipeline & Bundling

ROSS uses `esbuild` to compile your TypeScript and JavaScript function handlers automatically at server startup:

- **Self-Contained Output**: Each handler file is bundled into `.ross/functions/` as an isolated JavaScript file.
- **Local Helper Imports**: You can freely import local helper modules (e.g. `import { formatData } from './utils/format';`); they are bundled into the function output automatically.
- **Fast Startup**: Files are compiled once and cached, ensuring minimal overhead when starting up.

## Examples

### 1. Multi-Parameter Report Handler

Combines path parameters, query filters, request body, headers, and database querying:

```typescript
// src/functions/report.ts
export async function generateReport(request: any, app: any) {
  const { projectId, teamId } = request.params;
  const { format, includeMetrics } = request.query;
  const { title, threshold } = request.body;
  const clientId = request.headers['x-client-id'];

  // Query database using the uniform DB abstraction
  const dbRes = await app.db.query(
    'SELECT count(*) as count FROM tasks WHERE project_id = ?',
    [projectId]
  );

  return {
    projectId: Number(projectId),
    teamId: Number(teamId),
    format,
    includeMetrics: Boolean(includeMetrics),
    title,
    threshold: Number(threshold),
    clientId,
    taskCount: Number(dbRes.rows[0]?.count ?? 0),
    appName: app.appConfig.application.name
  };
}
```

### 2. Synchronous Compute Handler

Synchronous handlers run immediately without `async`/`await`:

```typescript
// src/functions/compute.ts
export function syncCompute(request: any) {
  const val = Number(request.params.value);
  return {
    doubled: val * 2,
    squared: val * val
  };
}
```

### 3. Cache Integration (Miss → Fetch → Store → Hit)

Using `app.cache` to reduce database load:

```typescript
// src/functions/cache.ts
export async function getDashboardStats(_request: any, app: any) {
  const cacheKey = 'dashboard_task_count';

  // 1. Check cache
  const cached = await app.cache.get(cacheKey);
  if (cached !== undefined && cached !== null) {
    return { fromCache: true, count: cached };
  }

  // 2. Cache miss: fetch from DB
  const dbRes = await app.db.query('SELECT count(*) as count FROM tasks');
  const count = Number(dbRes.rows[0]?.count ?? 0);

  // 3. Store in cache with 60-second TTL
  await app.cache.set(cacheKey, count, 60);

  return { fromCache: false, count };
}
```

### 4. RBAC-Protected Admin Function

Accessing the authenticated user context:

```typescript
// src/functions/admin.ts
export async function adminAudit(request: any) {
  // request.user contains decoded JWT payload
  return {
    auditLogged: true,
    performedBy: request.user.email,
    userRole: request.user.role
  };
}
```

## Security & RBAC Configuration

Custom functions are protected via the `apis` configuration section using the endpoint policy key:

```text
custom.<variant>.<group>.<model>.<endpointName>
```

Example configuration:

```json
{
  "apis": {
    "custom.v1.all.unknown.generateReport": {
      "authorization": false
    },
    "custom.v1.all.unknown.adminAudit": {
      "authorization": true,
      "roles": ["admin"]
    }
  }
}
```

- **`authorization: false`**: Public function endpoint.
- **`authorization: true`**: Requires a valid Bearer JWT.
- **`roles: ["admin"]`**: Rejects requests with `HTTP 403` if the authenticated user's role is not `"admin"`.
