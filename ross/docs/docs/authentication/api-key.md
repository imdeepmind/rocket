---
sidebar_position: 6
---

# API Key

The `api-key` provider authenticates requests with a single shared key instead of a user identity. It is intended for machine-to-machine access, internal tooling, and trusted integrations where per-user accounts and JWTs add no value.

Unlike `up-auth` and `sso`, the API key provider:

- has no user model and creates no identities,
- never issues an access token,
- exposes no auth routes,
- cannot be combined with any identity provider,
- cannot be used when RBAC is enabled.

Requests are accepted when they carry the configured key in the `x-api-key` header.

## Configuration

```json
{
  "authentication": {
    "enabled": true,
    "providers": [
      {
        "type": "api-key",
        "config": {
          "key": "env:ROSS_API_KEY"
        }
      }
    ]
  }
}
```

### Provider fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `"api-key"` | **Yes** | Provider identifier. |
| `config.key` | `string` | **Yes** | The shared secret. Minimum one character. |

Rules enforced at startup:

- At most one `api-key` provider is allowed.
- `api-key` cannot be combined with `up-auth` or `sso`.
- `jwtSecret` must **not** be present when only `api-key` is configured.
- `userModel` is not used. There is no identity table.
- `rbac.enabled: true` is rejected: RBAC needs per-user roles, which a shared key cannot provide.

A valid minimal configuration therefore needs only `enabled` and `providers`. `jwtSecret` must be absent, and `userModel` / `accessTokenExpiration` / `refreshTokenExpiration` / `sessionStorage` have no effect.

## Using the key

Send the key on every request to a protected endpoint:

```http
GET /api/v1/posts
x-api-key: your-shared-secret
```

The key applies to:

- Generated model, search, and aggregate APIs whose API policy has `authorization: true`.
- Custom endpoints whose policy has `authorization: true`.
- Any route that runs the authentication check.

It does not apply to auth routes, because none are mounted. Routes such as `/api/v1/auth/providers`, `/api/v1/auth/login`, and `/api/v1/auth/user/me` return `404 Not Found`.

A missing or incorrect key returns:

```json
{
  "code": 401,
  "message": "Invalid or expired authentication token",
  "data": null
}
```

## Protecting endpoints

API policies default `authorization` to the value of `authentication.enabled`, so enabling the provider protects the generated APIs that use authorization. You can also opt individual endpoints in or out:

```json
{
  "authentication": {
    "enabled": true,
    "providers": [
      {
        "type": "api-key",
        "config": {"key": "env:ROSS_API_KEY"}
      }
    ]
  },
  "apis": {
    "model.v1.posts.unknown.getAll": {"authorization": true},
    "model.v1.posts.unknown.insert": {"authorization": true},
    "custom.v1.all.unknown.healthSummary": {"authorization": false}
  }
}
```

`custom.v1.all.unknown.healthSummary` stays public; the model routes require the key.

## OpenAPI

When authentication resolves to an API key, the generated OpenAPI document advertises a single security scheme:

```json
{
  "components": {
    "securitySchemes": {
      "apiKeyAuth": {
        "type": "apiKey",
        "name": "x-api-key",
        "in": "header"
      }
    }
  }
}
```

Swagger UI's **Authorize** dialog accepts the key and applies it to documented protected operations.

## Custom functions

Because there is no JWT, `request.user` is never populated and `request.authenticate()` only verifies the header. Custom functions should rely on the API policy:

```json
{
  "apis": {
    "custom.v1.all.unknown.runExport": {"authorization": true}
  }
}
```

The handler runs only after the key check succeeds:

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function runExport(
  _request: FastifyRequest,
  app: FastifyInstance,
) {
  const rows = await app.db.query('SELECT * FROM "orders";');

  return {rows: rows.rows};
}
```

`app.jwt` is not registered, so token signing and verification are unavailable. If a custom function needs to know *who* called it, an API key is the wrong provider; use `up-auth` or SSO.

## Rotation

The key is compared with the value resolved at startup, so rotating it requires a restart:

1. Update the secret referenced by `env:ROSS_API_KEY` (or the literal value).
2. Restart ROSS.

There is no grace period and no key list, so plan rotations with the client teams that hold the key.

## Security notes

- Treat the key as a password. Store it in a secret manager and inject it with `env:`.
- The key is redacted as `***` when ROSS prints the resolved configuration.
- API-key authentication proves possession of the key, not the identity of a person. It provides no user-level audit trail, roles, or ownership.
- Use TLS. A shared key is replayable by anyone who observes it.
- Do not expose a key-authenticated endpoint to browsers: any frontend bundle containing the key distributes it to every visitor.
- Prefer `up-auth` or SSO for end-user traffic, and reserve API keys for trusted server-to-server callers.
