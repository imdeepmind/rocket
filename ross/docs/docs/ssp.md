---
sidebar_position: 9
---

# Server-Side Parameters (SSP)

Server-Side Parameters (SSP) allow you to inject, enforce, and override request parameters (`query` and `body`) on the server before route handlers execute.

When a parameter is configured as a Server-Side Parameter, it is treated as strictly server-managed and is no longer available to end users:

- **Invisible from Swagger / OpenAPI**: ROSS automatically strips the parameter from the public API schema and documentation (including query filters and schema required lists).
- **Clients Do Not Pass It**: Callers and API consumers do not need to supply the parameter in their requests.
- **Tamper-Proof Enforcement**: Even if a client sends the parameter in the request body or URL query string, ROSS overrides it with the server-configured value during request processing.

This provides a declarative mechanism to enforce data ownership, tenant isolation, and administrative constraints without exposing internal parameters to end users.

## Quick Example

Server-Side Parameters are configured per endpoint under the `apis` configuration block using the route's API identifier:

```json
{
  "apis": {
    "model.v1.posts.unknown.post": {
      "serverSideParams": [
        {
          "type": "body",
          "name": "author_id",
          "value": "[[userId]]"
        }
      ]
    },
    "model.v1.posts.unknown.getAll": {
      "serverSideParams": [
        {
          "type": "query",
          "name": "tenant_id",
          "value": 1
        }
      ]
    }
  }
}
```

In this example:

- Any `POST /api/v1/posts` request automatically has `request.body.author_id` set to the authenticated user's ID (`request.user.id`), preventing users from spoofing the author.
- Any `GET /api/v1/posts` request automatically filters by the literal server-defined `tenant_id` (`1`), preventing cross-tenant data leaks.

## Configuration Reference

Each entry in the `serverSideParams` array accepts the following properties:

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | `"query" \| "body"` | **Yes** | Target location in the incoming request where the parameter is injected. |
| `name` | `string` | **Yes** | The parameter name to set. Must be a valid entity identifier. |
| `value` | `string \| number \| boolean` | **Yes** | The static value to assign, or a magic variable placeholder (`"[[varName]]"`). |

### Parameter Types

ROSS supports injecting values into two distinct parts of an HTTP request:

- **`"body"`**: Injected into `request.body[name]`. Applies to mutation operations such as `POST`, `PUT`, and `PATCH`.
- **`"query"`**: Injected into `request.query[name]`. Applies to retrieval and filter operations such as `GET`, `search`, and `aggregate`.

Path parameters (`type: "path"`) cannot have Server-Side Parameters. Because HTTP routing relies on URL path segments to resolve endpoints (such as `/:id`), path parameters cannot be omitted from request URLs without causing routing failures (`404 Not Found`).

## Magic Variables

Instead of hardcoding static values, you can use **magic variables** to dynamically resolve parameter values from the authenticated user or application runtime configuration.

Magic variables use the double-bracket syntax: `[[variableName]]`.

### Built-in Magic Variables

ROSS provides built-in magic variables resolved from the authenticated user token:

| Variable | Source | Description |
| :--- | :--- | :--- |
| `[[userId]]` | `request.user.id` | The unique ID of the currently authenticated user. |
| `[[userEmail]]` | `request.user.email` | The email address of the currently authenticated user. |

If `request.user` is not populated (for example, on an unauthenticated public route), built-in magic variables resolve to `undefined`.

### Custom Magic Variables

You can define custom magic variables globally in `application.magicVariables`. Custom magic variables can hold strings, numbers, or booleans:

```json
{
  "application": {
    "name": "my-app",
    "magicVariables": {
      "defaultOrg": "org_production_01",
      "defaultTenant": 1001,
      "enforceActiveOnly": true
    }
  },
  "apis": {
    "model.v1.documents.unknown.getAll": {
      "serverSideParams": [
        {
          "type": "query",
          "name": "org_id",
          "value": "[[defaultOrg]]"
        },
        {
          "type": "query",
          "name": "is_active",
          "value": "[[enforceActiveOnly]]"
        }
      ]
    }
  }
}
```

### Resolution Order and Fallback

When ROSS encounters a value formatted as `[[varName]]`:

1. **`application.magicVariables`**: ROSS first checks if `varName` is defined in custom magic variables. If present, that value is used. Custom magic variables take precedence and can override built-ins.
2. **`[[userId]]`**: Resolves to `request.user.id`.
3. **`[[userEmail]]`**: Resolves to `request.user.email`.
4. **Fallback**: If `varName` is not recognized, ROSS leaves the literal string `[[varName]]` as the value.

Values without double brackets (including single brackets like `[userId]`) are treated as literal strings and assigned as-is.

## OpenAPI / Swagger Integration

ROSS automatically sanitizes generated OpenAPI and Swagger schemas so that server-side parameters are hidden from public API consumers:

- **Query Parameters**: Any property in `querystring` matching an SSP query name is removed. In addition, all generated query filter variants (such as `field_eq`, `field_ne`, `field_lt`, `field_lte`, `field_gt`, `field_gte`, `field_in`) are stripped from the schema.
- **Body Parameters**: Any property in `body` matching an SSP body name is removed from the schema and removed from the `required` fields array.

Because query and body parameters are removed from public schemas, API consumers are not prompted to provide internal or server-managed parameters in Swagger UI. Path parameters are not eligible for SSP because OpenAPI requires all path parameters in URL templates to remain defined, and HTTP routers require callers to supply them in the URL.

## Execution Lifecycle

Server-Side Parameters are enforced during Fastify's `preHandler` lifecycle hook:

1. **Route Pre-Validation & Authentication**: The route's authentication hook validates bearer tokens or API keys and populates `request.user`.
2. **Schema Validation**: Fastify validates incoming request payloads against the route's AJV validation schema.
3. **SSP Enforcement (`preHandler`)**: ROSS executes `enforceSSP`, injecting configured static values and resolving magic variables against `request.user` and `application.magicVariables`.
4. **Route Handler**: The database operation or custom endpoint runs using the sanitized, server-enforced parameters.

Because SSP runs in `preHandler`:

- Authenticated user context (`request.user`) is guaranteed to be available for `[[userId]]` and `[[userEmail]]`.
- Injected server parameters cannot be spoofed by incoming client payloads. If a client attempts to pass a forbidden field, ROSS overwrites it.

## Common Use Cases

### 1. Enforcing Resource Ownership on Creation

When creating records in a multi-user application, ensure that the created record always belongs to the authenticated caller:

```json
{
  "apis": {
    "model.v1.comments.unknown.post": {
      "authorization": true,
      "serverSideParams": [
        {
          "type": "body",
          "name": "user_id",
          "value": "[[userId]]"
        }
      ]
    }
  }
}
```

Even if a malicious client sends `{"user_id": 9999, "content": "Hello"}` in the request body, ROSS replaces `user_id` with the authenticated caller's user ID before inserting the row into the database.

### 2. Multi-Tenant Query Scoping

In multi-tenant systems, prevent clients from querying data outside their organization by locking query filters:

```json
{
  "apis": {
    "model.v1.invoices.unknown.getAll": {
      "authorization": true,
      "serverSideParams": [
        {
          "type": "query",
          "name": "org_id",
          "value": "[[defaultOrg]]"
        }
      ]
    }
  }
}
```

All index, filter, and pagination queries on `/api/v1/invoices` are automatically scoped to the configured organization ID.

### 3. Soft-Delete and Status Defaults

Enforce that public listings only return active or non-archived items:

```json
{
  "apis": {
    "model.v1.products.unknown.getAll": {
      "serverSideParams": [
        {
          "type": "query",
          "name": "is_active",
          "value": true
        }
      ]
    }
  }
}
```
