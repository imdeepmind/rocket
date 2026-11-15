---
sidebar_position: 1
---

# Introduction

ROSS has a built-in authentication layer that is entirely configuration-driven. You declare one or more **authentication providers** in the `authentication` block, and ROSS mounts the matching login routes, validates the configuration against your data model, and issues signed JWT access tokens that the generated APIs understand.

The authentication surface is built around a single contract:

```text
provider verifies the caller → ROSS resolves a local user row → ROSS issues one JWT
```

Password login, OAuth2, OIDC, and SAML differ only in how the caller is verified. They all converge on the same user table, the same access token, the same `Authorization: Bearer <token>` header, and the same RBAC claims. An `api-key` provider is the exception: it authenticates the caller statically, without a user row or a JWT.

Authentication is optional at the top level. When it is omitted, ROSS starts normally and every generated API is public unless you opt into route-level authorization.

## Supported providers

| Provider | Identifier | Caller verified by | Access token | Documentation |
| --- | --- | --- | --- | --- |
| Local password | `"up-auth"` | Username and password (bcrypt) | JWT | [Password authentication](./up-auth.md) |
| OAuth2 | `"sso"` with `"protocol": "oauth2"` | External OAuth2 authorization server | JWT | [OAuth2](./oauth2.md) |
| OpenID Connect | `"sso"` with `"protocol": "oidc"` | OpenID Provider (ID token + PKCE) | JWT | [OpenID Connect](./oidc.md) |
| SAML 2.0 | `"sso"` with `"protocol": "saml"` | SAML identity provider (signed assertion) | JWT | [SAML](./saml.md) |
| Static API key | `"api-key"` | A shared key sent in `x-api-key` | None | [API key](./api-key.md) |

## Configuration

Authentication lives at the top level of your configuration file:

```json
{
  "authentication": {
    "enabled": true,
    "jwtSecret": "env:JWT_SECRET",
    "tokenExpiration": "1d",
    "userModel": {
      "modelName": "users",
      "idField": "id",
      "providerField": "provider"
    },
    "providers": [
      {
        "type": "up-auth",
        "config": {
          "fields": {
            "usernameField": "email",
            "passwordField": "password"
          }
        }
      },
      {
        "type": "sso",
        "name": "google",
        "protocol": "oidc",
        "config": {
          "fields": {"providerIdField": "provider_id"},
          "issuerUrl": "https://accounts.google.com",
          "clientId": "env:GOOGLE_CLIENT_ID",
          "clientSecret": "env:GOOGLE_CLIENT_SECRET"
        }
      }
    ]
  }
}
```

### Shared fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | **Yes** | — | Enables the auth layer. When `false`, no other key may be present. |
| `jwtSecret` | `string` | Conditional | — | Secret used to sign access tokens. Minimum 32 characters. Required when an identity provider is configured, forbidden when only `api-key` is configured. |
| `tokenExpiration` | `string` | No | `"1d"` | Access-token lifetime. Pattern: digits followed by `s`, `m`, `h`, or `d` (for example `"15m"`, `"8h"`, `"7d"`). |
| `userModel` | `object` | Conditional | — | The table that stores identities. Required when `up-auth` or `sso` is configured. |
| `providers` | `array` | **Yes** | — | One or more provider entries. Minimum one item. |

`userModel` points ROSS at the table every identity provider shares:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `modelName` | `string` | **Yes** | Key of a model declared under `data.models`. |
| `idField` | `string` | **Yes** | Primary key column of that model. It becomes the `id` claim of the access token. |
| `providerField` | `string` | **Yes** | String column that records which provider owns the row (`"up-auth"` or the SSO provider `name`). Every guardrail that separates password accounts from SSO accounts reads this column. |

A model that supports both password and SSO accounts typically looks like this:

```json
{
  "data": {
    "models": {
      "users": {
        "fields": {
          "id": {"type": "integer", "primaryKey": true, "autoIncrement": true},
          "email": {"type": "string", "unique": true, "nullable": true},
          "password": {"type": "string", "nullable": true, "secret": true},
          "provider": {"type": "string", "nullable": false, "default": "up-auth"},
          "provider_id": {"type": "string", "nullable": true, "unique": true},
          "display_name": {"type": "string", "nullable": true}
        }
      }
    }
  }
}
```

:::note[SSO accounts are privacy-first]

SSO accounts are keyed strictly by `(providerField, providerIdField)`. No email or username is written unless you explicitly map a claim with `attributeMapping`. When you combine `up-auth` with SSO providers, the password and username columns must be `nullable: true` because SSO rows never populate them.

:::

### Provider constraints

Validation runs before the server starts, so configuration mistakes fail fast:

- At most **one** `up-auth` provider and at most **one** `api-key` provider may be configured.
- `api-key` cannot be combined with any identity provider. An application either authenticates users or accepts a shared key.
- Every identity provider requires `jwtSecret` and a `userModel` whose fields exist in the referenced model.
- SSO provider `name` values are lowercase alphanumeric with optional hyphens, up to 32 characters, and must be unique. Names that collide with auth route segments are reserved: `api-key`, `callback`, `change-email`, `change-password`, `edit-me`, `forgot-password`, `login`, `me`, `metadata`, `providers`, `register`, `registration`, `resend-otp`, `sso`, `token`, `up-auth`, `user`, `verify`.
- `up-auth` and SSO providers can be combined. `api-key` cannot.

## Access tokens

Every identity provider issues the same JWT. The payload is built from `userModel` and RBAC:

```json
{
  "id": 42,
  "email": "user@example.com",
  "role": "admin",
  "iat": 1730000000,
  "exp": 1730086400
}
```

- `id` is the value of `userModel.idField`.
- The username claim is named after the `up-auth` `usernameField` (for example `email`) and is present only when that column has a value. SSO accounts without that column simply do not get the claim.
- `role` or `roles` appear only when RBAC is enabled. They are extracted from `rbac.roleField`, falling back to `rbac.defaultRole`.
- The token is signed with `jwtSecret` and expires after `tokenExpiration`.
- Clients send it as `Authorization: Bearer <token>`.

Protected routes validate the token before the handler runs. A missing or invalid token returns `401` with `"Invalid or expired authentication token"`.

:::warning

Rotating `jwtSecret` invalidates every access token, every in-flight SSO flow, and every one-time SSO exchange code at once. Treat it as a deploy event.

:::

## Provider discovery

When at least one identity provider (`up-auth` or `sso`) is configured, ROSS exposes a discovery document:

```http
GET /api/v1/auth/providers
```

```json
{
  "code": 200,
  "message": "Authentication providers",
  "data": [
    {
      "type": "up-auth",
      "capabilities": ["password", "register"],
      "login": {"method": "POST", "url": "/api/v1/auth/login"}
    },
    {
      "type": "sso",
      "name": "google",
      "protocol": "oidc",
      "capabilities": ["initiate", "callback"],
      "login": {"method": "GET", "url": "/api/v1/auth/sso/google/login"}
    }
  ]
}
```

A frontend can render its entire login screen from this document. Provider names, protocols, capabilities, and login URLs never need to be hardcoded.

| Capability | Meaning |
| --- | --- |
| `password` | The provider accepts a username and password (`POST /auth/login`). |
| `register` | The provider supports self-service registration. |
| `mfa` | Login returns an OTP challenge before issuing a token. |
| `initiate` | The provider starts a browser redirect (`GET .../login`). |
| `callback` | The provider completes a redirect flow (`.../callback`). |
| `metadata` | The provider publishes SP metadata (`GET .../metadata`). |
| `token-exchange` | The redirect handoff returns a one-time code that can be exchanged for a token. |

Capabilities are derived from your configuration, never configured directly.

## Route availability

Auth routes are mounted under the API prefix and variant, so the default base path is `/api/v1`. Availability depends on the configured providers:

| Route | Requires |
| --- | --- |
| `GET /auth/providers` | At least one identity provider |
| `POST /auth/register` | `up-auth` |
| `POST /auth/login` | `up-auth` |
| `POST /auth/change-password` | `up-auth` |
| `GET`, `PATCH`, `DELETE /auth/user/me` | `up-auth` (these routes also serve SSO-owned rows in a mixed deployment) |
| `PATCH /auth/user/email` | `up-auth` + `fields.isVerifiedField` |
| `POST /auth/forgot-password` and its `verify/otp` and `resend/otp` routes | `up-auth` + `integrations.email` |
| `POST /auth/login/verify/otp` and `/login/resend/otp` | `up-auth` + `mfaRequired: true` |
| `POST /auth/register/verify/otp` and `/register/resend/otp` | `up-auth` + `fields.isVerifiedField` |
| `GET /auth/sso/<name>/login` and `.../callback` | Each SSO provider |
| `POST /auth/sso/<name>/token` | An SSO provider with `redirectUrl` |
| `GET /auth/sso/<name>/metadata` | A SAML provider |

Routes that do not match the configuration return `404 Not Found` rather than an error, so probing an unconfigured flow reveals nothing.

Every route above also has an API policy identifier of the form `auth.<variant>.<userModel>.unknown.<operation>`, for example `auth.v1.users.unknown.login` or `auth.v1.users.unknown.ssoLogin`. Use them under `apis` to disable a route, change its tags, or attach webhooks:

```json
{
  "apis": {
    "auth.v1.users.unknown.registration": {"enabled": false}
  }
}
```

Endpoints that require a token always require one. `apis` can disable them, but cannot make them public.

## SSO accounts and password routes

Accounts created by an SSO provider have no password. ROSS protects them from password operations with a `400` response:

```json
{
  "code": 400,
  "message": "Password management is not supported for accounts authenticated via google. Please manage your credentials through your identity provider.",
  "data": null
}
```

The guardrail applies to:

- `POST /auth/login` — a password login against an SSO-owned row.
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `PATCH /auth/user/email`

Account-level routes remain available to SSO users: `GET /auth/user/me`, `PATCH /auth/user/me`, and `DELETE /auth/user/me`.

Rows with no value in `providerField` are treated as `"up-auth"`, so existing password users keep working and can be migrated gradually.

## Custom functions and the authenticated user

[Custom function endpoints](../custom-endpoints/function.md) receive the Fastify `request` and instance `app`, so they can read the authenticated identity and perform auth-related work directly.

### Automatic authentication

Set `authorization: true` on the endpoint's API policy. ROSS validates the bearer token before your handler runs and populates `request.user`:

```json
{
  "customEndpoints": {
    "listMyOrders": {
      "method": "GET",
      "path": "/me/orders",
      "handler": {
        "type": "function",
        "file": "./src/functions/orders.ts",
        "exportName": "listMyOrders"
      }
    }
  },
  "apis": {
    "custom.v1.all.unknown.listMyOrders": {
      "authorization": true
    }
  }
}
```

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function listMyOrders(
  request: FastifyRequest,
  app: FastifyInstance,
) {
  const {id, email, role, roles} = request.user;

  const result = await app.db.query(
    'SELECT * FROM "orders" WHERE "user_id" = $1 ORDER BY "id" DESC;',
    [id],
  );

  return {
    userId: id,
    email,
    role: role ?? null,
    roles: roles ?? [],
    orders: result.rows,
  };
}
```

`request.user` contains the decoded JWT payload: `id`, the username claim when present, and `role` / `roles` when RBAC is enabled. It is not the full database row.

### Manual authentication

An endpoint with `authorization: false` can still demand authentication. `request.authenticate()` runs the configured check — a bearer JWT when an identity provider is configured, or the `x-api-key` header for an API key — and populates `request.user` for JWT providers. Throw an error with `statusCode: 401` to return the standard envelope when verification fails:

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function optionalProfile(
  request: FastifyRequest,
  app: FastifyInstance,
) {
  try {
    await request.authenticate();
  } catch {
    throw Object.assign(new Error('Invalid or expired authentication token'), {
      statusCode: 401,
    });
  }

  return {userId: request.user.id};
}
```

Use manual authentication when only part of the response depends on the caller, or when the endpoint must stay reachable for anonymous users.

### Loading the full user row

The token only carries the identity claims. To return the whole record, read it from the model named by `userModel`:

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function getMyProfile(
  request: FastifyRequest,
  app: FastifyInstance,
) {
  const {authentication} = app.appConfig;

  if (!authentication.enabled || !authentication.userModel) {
    throw Object.assign(new Error('Authentication is not configured'), {
      statusCode: 500,
    });
  }

  const {modelName, idField} = authentication.userModel;
  const result = await app.db.query(
    `SELECT * FROM "${modelName}" WHERE "${idField}" = $1 LIMIT 1;`,
    [request.user.id],
  );

  const user = result.rows[0];

  if (!user) {
    throw Object.assign(new Error('User not found'), {statusCode: 404});
  }

  // Remove secrets before returning the row to the client.
  delete user.password;

  return user;
}
```

### Verifying a token you received yourself

If the token arrives somewhere other than the `Authorization` header (a cookie, a query parameter, a webhook payload), verify it with `app.jwt.verify`. The decorator exists whenever `jwtSecret` is configured:

```typescript
import type {FastifyInstance, FastifyRequest} from 'fastify';

export async function resumeSession(
  request: FastifyRequest,
  app: FastifyInstance,
) {
  const token = request.cookies.session;

  if (!token) {
    throw Object.assign(new Error('Missing session token'), {statusCode: 401});
  }

  try {
    const payload = app.jwt.verify(token) as {id: string; role?: string};
    return {userId: payload.id, role: payload.role ?? null};
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), {statusCode: 401});
  }
}
```

`app.jwt` exists only when authentication is enabled with a `jwtSecret`. `request.authenticate` is always decorated: with authentication disabled it rejects every call, and with `api-key` it checks the shared key. With `api-key` only, protect custom endpoints through the API policy instead:

```json
{
  "apis": {
    "custom.v1.all.unknown.listMyOrders": {"authorization": true}
  }
}
```

The caller must then send `x-api-key`.

:::tip

`request.authenticate()` reads the `Authorization: Bearer` header. Prefer it over manual verification unless you control where the token is stored.

:::

## Secrets and environment variables

Any configuration string supports the `env:` prefix, so credentials never need to be committed:

```json
{
  "authentication": {
    "jwtSecret": "env:JWT_SECRET",
    "providers": [
      {
        "type": "sso",
        "name": "google",
        "protocol": "oidc",
        "config": {
          "fields": {"providerIdField": "provider_id"},
          "issuerUrl": "https://accounts.google.com",
          "clientId": "env:GOOGLE_CLIENT_ID",
          "clientSecret": "env:GOOGLE_CLIENT_SECRET"
        }
      }
    ]
  }
}
```

When ROSS prints the resolved configuration, auth secrets are masked: `jwtSecret`, `api-key` `key`, SSO `clientSecret`, and SAML `cert` all render as `***`.

## Security model

- SSO state is sealed with AES-256-GCM using an HKDF-derived key. SSO material never shares a key with token signing.
- The state cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to `Path=/`, prefixed `__Host-`, and expires after 10 minutes.
- OIDC adds PKCE (`S256`) and nonce validation. SAML validates signed assertions and `InResponseTo`.
- Redirect targets are always configuration values, never client-supplied, so an open-redirect allow-list is unnecessary.
- Passwords are hashed with bcrypt using 10 salt rounds.
- OTPs are six digits, stored hashed in the configured cache, and expire after 10 minutes.

## Next steps

- [Password authentication](./up-auth.md) — local accounts, MFA, verification, and account management.
- [OAuth2](./oauth2.md) — generic authorization-code providers such as GitHub.
- [OpenID Connect](./oidc.md) — discovery-based providers such as Google, Okta, Auth0, and Keycloak.
- [SAML](./saml.md) — enterprise identity providers with SP metadata.
- [API key](./api-key.md) — static shared-key access without user identities.
