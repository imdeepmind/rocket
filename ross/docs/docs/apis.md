---
sidebar_position: 10
---

# Route Policies (`apis`)

The `apis` configuration section is the central policy engine for every HTTP route generated or registered by ROSS.

By default, ROSS inspects your data models, custom endpoints, and authentication providers to automatically generate secure RESTful routes with standard OpenAPI schemas, validation, and documentation tags. The `apis` block provides granular, declarative control to customize, protect, or disable individual endpoints without modifying your underlying database schema or application code.

## Quick Example

```json
{
  "apis": {
    "model.v1.posts.id.delete": {
      "enabled": false
    },
    "model.v1.posts.unknown.getAll": {
      "authorization": false,
      "tags": ["Public Content"]
    },
    "model.v1.posts.title.search": {
      "authorization": true,
      "roles": ["admin", "editor"],
      "supportedQueries": ["eq", "in", "sort"]
    }
  }
}
```

## API Identifiers

Every route in ROSS has a deterministic, five-segment **API Identifier** formatted as:

```text
<module>.<variant>.<model>.<field>.<operation>
```

| Segment | Description | Allowed Values |
| --- | --- | --- |
| `<module>` | The subsystem or route generator | `model`, `aggregate`, `auth`, `custom` |
| `<variant>` | The API version or route prefix | `v1` (default) |
| `<model>` | Target model name or scope | Model name from `data.models`, or `all` for custom endpoints |
| `<field>` | Target field name or placeholder | Target field name for field-scoped routes, or `unknown` |
| `<operation>` | The specific operation name | Operation identifier (see reference below) |

### 1. Model Routes (`model`)

Generated from models declared under `data.models`:

| API Identifier Pattern | HTTP Method & Path | Description |
| --- | --- | --- |
| `model.<variant>.<model>.unknown.insert` | `POST /{variant}/{model}` | Insert a new record into the model. |
| `model.<variant>.<model>.unknown.getAll` | `GET /{variant}/{model}` | Paginated query returning all records. |
| `model.<variant>.<model>.<field>.index` | `GET /{variant}/{model}/index/{field}/:{field}` | Lookup a record by primary key, unique key, or indexed field. |
| `model.<variant>.<model>.<field>.search` | `POST /{variant}/{model}/search/{field}` | Search records matching criteria against the specified field. |
| `model.<variant>.<model>.<field>.edit` | `PATCH /{variant}/{model}/edit/{field}/:{field}` | Update records identified by the specified field. |
| `model.<variant>.<model>.<field>.delete` | `DELETE /{variant}/{model}/delete/{field}/:{field}` | Delete records identified by the specified field. |

### 2. Aggregation Routes (`aggregate`)

Generated for fields with statistical aggregations configured under `data.models.<model>.fields.<field>.aggregations`:

| API Identifier Pattern | HTTP Method & Path | Description |
| --- | --- | --- |
| `aggregate.<variant>.<model>.<field>.getAggregation` | `POST /{variant}/aggregate/{model}/{field}` | Execute statistical aggregations (`count`, `avg`, `sum`, `min`, `max`, `frequency`) on the field. |

### 3. Authentication Routes (`auth`)

Generated when `authentication.enabled: true`:

| API Identifier | HTTP Method & Path | Description |
| --- | --- | --- |
| `auth.<variant>.<userModel>.unknown.providers` | `GET /{variant}/auth/providers` | List available authentication providers. |
| `auth.<variant>.<userModel>.unknown.me` | `GET /{variant}/auth/me` | Fetch authenticated user profile. |
| `auth.<variant>.<userModel>.unknown.editMe` | `PATCH /{variant}/auth/me` | Update authenticated user profile. |
| `auth.<variant>.<userModel>.unknown.deleteMe` | `DELETE /{variant}/auth/me` | Delete authenticated user account. |
| `auth.<variant>.<userModel>.unknown.registration` | `POST /{variant}/auth/registration` | Register a new username/password account. |
| `auth.<variant>.<userModel>.unknown.login` | `POST /{variant}/auth/login` | Authenticate with username and password. |
| `auth.<variant>.<userModel>.unknown.changePassword` | `POST /{variant}/auth/change-password` | Update account password. |
| `auth.<variant>.<userModel>.unknown.forgotPassword` | `POST /{variant}/auth/forgot-password` | Request password reset OTP (requires email integration). |
| `auth.<variant>.<userModel>.unknown.otpVerifyForgotPassword` | `POST /{variant}/auth/otp-verify-forgot-password` | Verify password reset OTP. |
| `auth.<variant>.<userModel>.unknown.resendOtpForgotPassword` | `POST /{variant}/auth/resend-otp-forgot-password` | Resend password reset OTP. |
| `auth.<variant>.<userModel>.unknown.otpVerifyLogin` | `POST /{variant}/auth/otp-verify-login` | Verify MFA login OTP (when `mfaRequired: true`). |
| `auth.<variant>.<userModel>.unknown.resendOtpLogin` | `POST /{variant}/auth/resend-otp-login` | Resend MFA login OTP. |
| `auth.<variant>.<userModel>.unknown.otpVerifyRegister` | `POST /{variant}/auth/otp-verify-register` | Verify registration email OTP. |
| `auth.<variant>.<userModel>.unknown.resendOtpRegister` | `POST /{variant}/auth/resend-otp-register` | Resend registration email OTP. |
| `auth.<variant>.<userModel>.unknown.emailChange` | `POST /{variant}/auth/email-change` | Request email address change verification. |
| `auth.<variant>.<userModel>.unknown.ssoLogin` | `POST /{variant}/auth/sso/login` | Initiate SSO login flow. |
| `auth.<variant>.<userModel>.unknown.ssoCallback` | `POST /{variant}/auth/sso/callback` | Handle identity provider SSO callback. |
| `auth.<variant>.<userModel>.unknown.ssoMetadata` | `GET /{variant}/auth/sso/metadata` | Export SAML SP metadata (when SAML provider configured). |
| `auth.<variant>.<userModel>.unknown.ssoToken` | `POST /{variant}/auth/sso/token` | Exchange SSO authorization code for token. |

### 4. Custom Endpoints (`custom`)

Generated for user-defined SQL or JavaScript/TypeScript function endpoints in `customEndpoints`:

| API Identifier Pattern | Description |
| --- | --- |
| `custom.<variant>.all.unknown.<customEndpointKey>` | Custom SQL or function endpoint registered under `customEndpoints.<customEndpointKey>`. |

## Route Policy Properties

Each entry in `apis` is keyed by its API Identifier and accepts the following policy options:

```typescript
interface RoutePolicyConfig {
  enabled?: boolean;
  authorization?: boolean;
  roles?: string[];
  tags?: string[];
  supportedQueries?: ('eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in' | 'sort')[];
  supportedAggregations?: ('count' | 'avg' | 'sum' | 'min' | 'max' | 'frequency')[];
  bypassSecret?: boolean;
  serverSideParams?: ServerSideParamConfig[];
  webhooks?: WebhookConfig[];
}
```

### `enabled`

- **Type**: `boolean`
- **Default**: `true` (see auth user model exception below)

Controls whether ROSS registers the route in the HTTP router. Setting `enabled: false` completely deactivates the route without removing the underlying model or custom endpoint definition. Calls to a disabled route return `404 Not Found`.

```json
{
  "apis": {
    "model.v1.users.id.delete": {
      "enabled": false
    }
  }
}
```

:::warning[Default Protection for Auth User Models]

When authentication is enabled with an identity provider (`up-auth` or `sso`), all auto-generated CRUD routes for the auth user model (e.g. `model.v1.users.*`) are **disabled by default** (`enabled: false`). This safeguard prevents accidental exposure of user credentials and password hashes through generic CRUD endpoints.

If your application needs administrative user management routes, you must explicitly enable each route:

```json
{
  "apis": {
    "model.v1.users.unknown.getAll": {
      "enabled": true,
      "roles": ["admin"]
    }
  }
}
```

:::

### `authorization`

- **Type**: `boolean`
- **Default**: Inherits global `authentication.enabled` value

Enforces JWT Bearer token authentication on the route via Fastify's authentication preValidation hook.

- Setting `authorization: true` requires callers to supply a valid JWT in the `Authorization: Bearer <token>` header.
- Setting `authorization: false` marks a specific route as public, even when global authentication is enabled.

:::note

Setting `"authorization": true` is only permitted when `authentication.enabled` is `true` in your root configuration.

:::

```json
{
  "apis": {
    "model.v1.posts.unknown.getAll": {
      "authorization": false
    }
  }
}
```

### `roles`

- **Type**: `string[]`
- **Default**: `undefined`

Enforces Role-Based Access Control (RBAC) on the endpoint. Callers must present a valid JWT whose claims contain at least one of the specified roles.

- Requires `rbac.enabled: true` and `authentication.enabled: true`.
- An endpoint configuring `roles` must explicitly declare `"authorization": true`.
- Requires concrete declared role names (e.g. `["admin", "editor"]`). Wildcards (`*` and `prefix:*`) are reserved for defining role hierarchies in `rbac.roles.<role>.includes`.

```json
{
  "apis": {
    "model.v1.articles.id.edit": {
      "authorization": true,
      "roles": ["admin", "editor"]
    }
  }
}
```

### `tags`

- **Type**: `string[]`
- **Default**: Derived automatically from the route identifier

Overrides the OpenAPI / Swagger documentation tags and sidebar grouping for the endpoint.

By default, ROSS derives tags automatically using the following conventions:

- **`model` routes**: `[ModelName, "Read" | "Insert" | "Update" | "Delete"]`
- **`aggregate` routes**: `[ModelName, "Read"]`
- **`auth` routes**: `[ModelName, "Auth", "Login" | "Register" | "Password" | "Profile" | "OTP"]`
- **`custom` routes**: `["Custom Endpoints"]`

You can customize tags to group related endpoints under domain-specific categories:

```json
{
  "apis": {
    "model.v1.orders.unknown.insert": {
      "tags": ["Checkout & Billing", "Customer API"]
    }
  }
}
```

### `supportedQueries`

- **Type**: `Array<'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in' | 'sort'>`
- **Default**: All query operations enabled on the model's fields

Whitelists the filter and sorting operations clients are permitted to execute on `model.*` endpoints.

- Only valid on `model.*` routes.
- Every operation listed in `supportedQueries` must be supported by at least one field in the target model.
- Restricts the query parameters accepted by the route and visible in the OpenAPI documentation. Any query filters outside `supportedQueries` are rejected with validation errors.

```json
{
  "apis": {
    "model.v1.transactions.unknown.getAll": {
      "supportedQueries": ["eq", "gte", "lte", "sort"]
    }
  }
}
```

### `supportedAggregations`

- **Type**: `Array<'count' | 'avg' | 'sum' | 'min' | 'max' | 'frequency'>`
- **Default**: All aggregations configured on the field

Whitelists the aggregation operations clients can execute on `aggregate.*` endpoints.

- Only valid on `aggregate.*` routes.
- Every operation in `supportedAggregations` must be declared in `data.models.<model>.fields.<field>.aggregations`.
- Prevents expensive operations (such as `frequency` or `sum` on large datasets) from being requested on specific endpoints.

```json
{
  "apis": {
    "aggregate.v1.orders.total_amount.getAggregation": {
      "supportedAggregations": ["count", "sum"]
    }
  }
}
```

### `bypassSecret`

- **Type**: `boolean`
- **Default**: `false`

Controls whether fields configured with `secret: true` in `data.models` are exposed by the endpoint.

By default, ROSS automatically excludes secret fields from API responses, OpenAPI query parameters, and search filters. Setting `bypassSecret: true` permits the endpoint to include secret fields. This is commonly used for internal administrative routes or secure background tasks:

```json
{
  "apis": {
    "model.v1.api_keys.unknown.getAll": {
      "bypassSecret": true,
      "authorization": true,
      "roles": ["admin"]
    }
  }
}
```

### `serverSideParams`

- **Type**: `ServerSideParamConfig[]`
- **Default**: `[]`

Configures Server-Side Parameters (SSP) to inject server-enforced values (such as tenant IDs or authenticated user IDs) into `query` or `body` parameters. When configured, parameters are hidden from OpenAPI documentation and cannot be passed or overridden by end users.

For complete documentation on configuration, magic variables (`[[userId]]`, `[[userEmail]]`, custom variables), execution timing, and examples, see the dedicated [Server-Side Parameters (SSP)](./ssp.md) guide.

```json
{
  "apis": {
    "model.v1.posts.unknown.insert": {
      "serverSideParams": [
        {
          "type": "body",
          "name": "author_id",
          "value": "[[userId]]"
        }
      ]
    }
  }
}
```

### `webhooks`

- **Type**: `WebhookConfig[]`
- **Default**: `[]`

Configures outbound HTTP `POST` notifications dispatched to external URLs when the route executes. Supports triggering on request, on response, and custom header signing.

For detailed configuration options, payload shapes, and retry mechanisms, see the [Webhooks](./webhooks.md) guide.

```json
{
  "apis": {
    "model.v1.orders.unknown.insert": {
      "webhooks": [
        {
          "url": "https://hooks.slack.com/services/EXAMPLE",
          "data": ["body", "response"],
          "triggerOnRequest": false,
          "triggerOnResponse": true
        }
      ]
    }
  }
}
```

## Comprehensive Configuration Example

The following example illustrates a production policy configuration combining route deactivation, public endpoints, RBAC, query whitelisting, and secret bypass:

```json
{
  "apis": {
    "model.v1.posts.id.delete": {
      "enabled": false
    },
    "model.v1.posts.unknown.getAll": {
      "authorization": false,
      "tags": ["Public Content"]
    },
    "model.v1.posts.title.search": {
      "authorization": true,
      "roles": ["admin", "editor"],
      "supportedQueries": ["eq", "in", "sort"],
      "tags": ["Content Management"]
    },
    "model.v1.users.unknown.getAll": {
      "enabled": true,
      "authorization": true,
      "roles": ["admin"],
      "tags": ["User Administration"]
    },
    "model.v1.users.id.index": {
      "enabled": true,
      "authorization": true,
      "roles": ["admin"],
      "bypassSecret": true,
      "tags": ["User Administration"]
    },
    "aggregate.v1.posts.views.getAggregation": {
      "supportedAggregations": ["count", "avg", "sum"]
    }
  }
}
```

## Validation & Common Errors

ROSS validates all `apis` entries during initialization. Common validation errors include:

- **`apis/<key>: invalid key format`**: The identifier does not contain exactly 5 dot-separated segments.
- **`apis/<key>: does not match any generated API route`**: The identifier refers to a non-existent model, invalid field, or an operation that ROSS does not generate.
- **`apis/<key>/authorization: authorization is only allowed when auth is enabled`**: Set `authentication.enabled: true` in your root config before setting `authorization: true`.
- **`apis/<key>/roles: endpoint with roles must have authorization enabled`**: Whenever `roles` are defined on a route policy, `"authorization": true` must be explicitly declared on that same entry.
- **`apis/<key>/supportedQueries: supportedQueries is only allowed on model APIs`**: `supportedQueries` cannot be set on `auth`, `aggregate`, or `custom` endpoints.
- **`apis/<key>/supportedAggregations: supportedAggregations is only allowed on aggregate APIs`**: `supportedAggregations` cannot be set on non-aggregate routes.
