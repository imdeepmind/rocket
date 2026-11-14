---
sidebar_position: 2
---

# Custom SQL Endpoints

Custom SQL endpoints allow you to expose raw parameterized SQL queries as REST API endpoints directly from your configuration file without writing backend code.

They are ideal for complex queries, joins, aggregations, reporting, and custom mutations that go beyond standard auto-generated CRUD operations.

## Configuration Reference

Custom SQL endpoints are declared in the `customEndpoints` block of your configuration:

```json
{
  "customEndpoints": {
    "<endpointName>": {
      "method": "GET",
      "path": "/projects/:projectId/tasks",
      "description": "Fetch tasks for a specific project",
      "validation": { ... },
      "handler": {
        "type": "sql",
        "sql": "SELECT * FROM tasks WHERE project_id = [[path.projectId:integer]];"
      }
    }
  }
}
```

### Endpoint Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `method` | `string` | **Yes** | HTTP method: `"GET"`, `"POST"`, `"PUT"`, `"PATCH"`, or `"DELETE"`. |
| `path` | `string` | **Yes** | Route path (e.g. `/analytics/summary` or parameterized `/projects/:projectId/tasks`). |
| `description` | `string` | No | Human-readable description, displayed in interactive OpenAPI/Swagger docs. |
| `validation` | `object` | No | Standard JSON Schema defining input constraints for parameters. |
| `handler` | `object` | **Yes** | Handler configuration object with `type: "sql"`. |

### Handler Fields (`type: "sql"`)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `"sql"` | **Yes** | Must be `"sql"`. |
| `sql` | `string` | **Yes** | The SQL query with parameterized placeholder tokens. |

## Placeholder Syntax

Dynamic inputs are injected into your SQL query using double-bracket tokens:

```text
[[source.name:type]]
```

ROSS parses these tokens and binds them into native parameterized queries (`$1`, `$2` in PostgreSQL; `?` in SQLite). Values are never concatenated directly into the query string, preventing SQL injection vulnerabilities.

### Supported Sources

| Source | Description | Example |
| --- | --- | --- |
| `path` | URL path parameter (e.g. `:projectId` in route path) | `[[path.projectId:integer]]` |
| `query` | URL query parameter (e.g. `?status=active`) | `[[query.status:string]]` |
| `body` | JSON request body property | `[[body.title:string]]` |
| `header` | Incoming HTTP request header | `[[header.x-tenant-id:integer]]` |

### Supported Types

ROSS casts and validates the bound parameters according to the declared type:

- `integer`: Whole numbers
- `decimal`: Floating-point numbers
- `string`: Text / characters
- `text`: Long text
- `boolean`: Boolean values (`true`/`false`)
- `date`: Calendar dates (`YYYY-MM-DD`)
- `datetime`: ISO-8601 timestamps
- `enum`: Constrained string values
- `json`: JSON object or array values
- `uuid`: Standard UUID strings
- `ulid`: ULID strings

## Examples

### 1. Multi-Parameter SELECT with Filtering

Fetch tasks with path parameter, query filters, and limit:

```json
{
  "customEndpoints": {
    "getTasksByProject": {
      "method": "GET",
      "path": "/projects/:projectId/tasks",
      "description": "List filtered tasks for a project",
      "validation": {
        "type": "object",
        "required": ["projectId"],
        "properties": {
          "projectId": { "type": "integer", "minimum": 1 },
          "minHours": { "type": "number", "minimum": 0 },
          "completed": { "type": "boolean" },
          "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
        }
      },
      "handler": {
        "type": "sql",
        "sql": "SELECT id, title, estimate_hours, is_completed FROM tasks WHERE project_id = [[path.projectId:integer]] AND estimate_hours >= [[query.minHours:decimal]] AND is_completed = [[query.completed:boolean]] LIMIT [[query.limit:integer]];"
      }
    }
  }
}
```

### 2. Complex Join & Aggregation

Summarize project statistics across multiple tables:

```json
{
  "customEndpoints": {
    "projectTaskSummary": {
      "method": "GET",
      "path": "/projects/:projectId/summary",
      "description": "Calculate project completion metrics",
      "handler": {
        "type": "sql",
        "sql": "SELECT p.id, p.name, count(t.id) AS total_tasks, coalesce(sum(t.estimate_hours), 0) AS total_hours FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE p.id = [[path.projectId:integer]] GROUP BY p.id, p.name;"
      }
    }
  }
}
```

### 3. Parameterized UPDATE Mutation

Update task details using both URL path and JSON body inputs:

```json
{
  "customEndpoints": {
    "updateTask": {
      "method": "PUT",
      "path": "/tasks/:taskId",
      "description": "Update task title and status",
      "validation": {
        "type": "object",
        "required": ["taskId", "title", "estimateHours"],
        "properties": {
          "taskId": { "type": "integer" },
          "title": { "type": "string", "minLength": 1 },
          "estimateHours": { "type": "number", "minimum": 0.5 },
          "isCompleted": { "type": "boolean" }
        }
      },
      "handler": {
        "type": "sql",
        "sql": "UPDATE tasks SET title = [[body.title:string]], estimate_hours = [[body.estimateHours:decimal]], is_completed = [[body.isCompleted:boolean]] WHERE id = [[path.taskId:integer]];"
      }
    }
  }
}
```

## Response Envelope

All custom SQL endpoints wrap query execution results in the standard ROSS response structure:

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": 1,
        "title": "Setup database",
        "estimate_hours": 4.5,
        "is_completed": 1
      }
    ],
    "res": {
      "changes": 0
    }
  }
}
```

- `data.data`: Array of rows returned by `SELECT` queries (or empty array `[]` when no rows match).
- `data.res.changes`: Number of rows affected by `INSERT`, `UPDATE`, or `DELETE` statements.

## Security & RBAC Configuration

Custom endpoints integrate with the ROSS API policy system under the `apis` configuration section.

The API policy key format for custom endpoints is:

```text
custom.<variant>.<group>.<model>.<endpointName>
```

For standard default configurations, the key resolves as `custom.<variant>.all.unknown.<endpointName>` (e.g. `custom.v1.all.unknown.getTasksByProject`):

```json
{
  "apis": {
    "custom.v1.all.unknown.getTasksByProject": {
      "authorization": false
    },
    "custom.v1.all.unknown.updateTask": {
      "authorization": true,
      "roles": ["admin", "manager"]
    }
  }
}
```

- **`authorization: false`**: Public endpoint, accessible without authentication.
- **`authorization: true`**: Requires a valid Bearer JWT. Unauthorized requests receive `HTTP 401`.
- **`roles: ["admin"]`**: Enforces Role-Based Access Control. Authenticated users without the specified role receive `HTTP 403 Forbidden`.
