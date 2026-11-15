---
sidebar_position: 3
---

# OAuth2

The `sso` provider with `"protocol": "oauth2"` implements the OAuth2 **authorization code** flow against a generic authorization server. Use it for providers that expose OAuth2 endpoints but do not publish an OpenID Connect discovery document, such as GitHub.

ROSS starts the flow, exchanges the authorization code for an access token, reads the user's profile from a Userinfo endpoint, and maps a stable subject claim to a local user row. The result is the same JWT access token every other provider issues.

## Configuration

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
        "type": "sso",
        "name": "github",
        "protocol": "oauth2",
        "config": {
          "fields": {"providerIdField": "provider_id"},
          "authorizeUrl": "https://github.com/login/oauth/authorize",
          "tokenUrl": "https://github.com/login/oauth/access_token",
          "userInfoUrl": "https://api.github.com/user",
          "idClaim": "id",
          "clientId": "env:GITHUB_CLIENT_ID",
          "clientSecret": "env:GITHUB_CLIENT_SECRET",
          "scopes": ["read:user"],
          "attributeMapping": {
            "name": "display_name",
            "email": "email"
          }
        }
      }
    ]
  }
}
```

### Provider fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `type` | `"sso"` | **Yes** | — | Provider identifier. |
| `name` | `string` | **Yes** | — | Unique lowercase provider name used in routes and in `providerField`. Pattern: `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, maximum 32 characters. |
| `protocol` | `"oauth2"` | **Yes** | — | Selects this adapter. |
| `config.fields.providerIdField` | `string` | **Yes** | — | String column that stores the provider's subject together with `providerField`. |
| `config.authorizeUrl` | `string` | **Yes** | — | Authorization endpoint the browser is redirected to. |
| `config.tokenUrl` | `string` | **Yes** | — | Token endpoint used for the server-side code exchange. |
| `config.userInfoUrl` | `string` | No | — | Endpoint that returns the user profile. Without it the flow has no claims and therefore no subject, so it is required in practice. |
| `config.idClaim` | `string` | No | `sub`, `id`, `user_id`, `login` | Claim that holds the stable subject. When set, only that claim is considered. |
| `config.clientId` | `string` | **Yes** | — | OAuth2 client identifier. |
| `config.clientSecret` | `string` | **Yes** | — | OAuth2 client secret. Sent in the token request body (`client_secret_post`). |
| `config.scopes` | `string[]` | No | `[]` | Scopes joined with spaces into the `scope` parameter. Omitted when empty. |
| `config.attributeMapping` | `object` | No | `{}` | Map of profile claim name to model column. |
| `config.callbackUrl` | `string` | No | Derived per request | Absolute URL registered with the provider. Must end with `/auth/sso/<name>/callback`. |
| `config.redirectUrl` | `string` | No | — | Frontend landing page after a successful login. When absent, the callback returns JSON. |
| `config.failureRedirectUrl` | `string` | No | `redirectUrl` | Frontend landing page after a failed login. Requires `redirectUrl`. |

All URLs must be absolute and use `https`; plain `http` is accepted only for `localhost` and `127.0.0.1`.

### Callback URL

When `callbackUrl` is omitted, ROSS derives it from the request that started the flow:

```text
https://api.example.com/api/v1/auth/sso/github/callback
```

The path is the login route with `/login` replaced by `/callback`. Register that exact value at the provider. To support several variants, reverse-proxy mounts, or a fixed public host, set `callbackUrl` explicitly.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/auth/sso/github/login` | Starts the flow and redirects to the provider |
| `GET` | `/api/v1/auth/sso/github/callback` | Receives the authorization code and completes login |
| `POST` | `/api/v1/auth/sso/github/token` | Exchanges a one-time code for an access token (only with `redirectUrl`) |
| `GET` | `/api/v1/auth/providers` | Lists configured providers (shared by all identity providers) |

## Flow

```text
1. Browser  GET  /auth/sso/github/login
2. ROSS     302  https://github.com/login/oauth/authorize?response_type=code
                 &client_id=...&redirect_uri=...&state=...&scope=read:user
                 Set-Cookie: __Host-ross_sso_github=<sealed state>; HttpOnly; Secure; SameSite=Lax
3. Provider 302  /auth/sso/github/callback?code=...&state=...
4. ROSS     POST https://github.com/login/oauth/access_token
5. ROSS     GET  https://api.github.com/user  (Bearer token)
6. ROSS     find-or-create the local user for (github, <subject>)
7. ROSS     200  {"accessToken": "..."}   or   302 <redirectUrl>?code=<one-time code>
```

### 1. Start the flow

`GET /api/v1/auth/sso/github/login` performs three actions:

- Generates a random `state` value and seals the correlation payload.
- Sets the `__Host-ross_sso_github` cookie.
- Responds `302` with the provider authorization URL.

The state cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to `Path=/`, and expires after 10 minutes. The payload is encrypted with AES-256-GCM using an HKDF-derived key.

### 2. Handle the callback

```http
GET /api/v1/auth/sso/github/callback?code=abc&state=xyz
Cookie: __Host-ross_sso_github=<sealed>
```

ROSS validates the sealed state, compares the `state` query parameter in constant time, clears the cookie, then:

1. `POST`s `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, and `client_secret` to `tokenUrl`.
2. Reads `access_token` from the JSON response.
3. `GET`s `userInfoUrl` with `Authorization: Bearer <access_token>`.
4. Extracts the subject from `idClaim`, or from `sub`, `id`, `user_id`, then `login`.
5. Finds or creates the local user.

A callback without a valid state cookie, with a mismatched state, or with a provider error does not issue a token. It follows the [failure behaviour](#failure-handling).

## Identity resolution

Users are looked up by the pair `(providerField, providerIdField)`:

```sql
SELECT * FROM "users" WHERE "provider" = 'github' AND "provider_id" = '123456' LIMIT 1;
```

When no row exists, ROSS inserts one with:

- `provider = "github"`
- `provider_id = <subject>`
- any `attributeMapping` column whose claim is present and not `null`

```json
{
  "attributeMapping": {
    "name": "display_name",
    "email": "email"
  }
}
```

With the profile `{"id": 123456, "name": "Octocat", "email": null}`, the inserted row is:

```json
{"provider": "github", "provider_id": "123456", "display_name": "Octocat"}
```

The mapping never overwrites the identity columns, and a concurrent first login that wins the unique constraint is recovered by re-reading the row. No email or username is required for SSO accounts.

## Token handoff

### JSON mode

When `redirectUrl` is not configured, the callback responds directly with the access token:

```json
{
  "code": 200,
  "message": "SSO authentication successful",
  "data": {"accessToken": "eyJhbGciOi..."}
}
```

### Redirect mode

When `redirectUrl` is configured, the browser is sent back to your frontend with a short-lived code instead of a token:

```http
HTTP/1.1 302 Found
Location: https://app.example.com/done?code=eyJhbGciOi...
```

The frontend exchanges it server-to-server:

```http
POST /api/v1/auth/sso/github/token
Content-Type: application/json

{"code": "eyJhbGciOi..."}
```

```json
{
  "code": 200,
  "message": "SSO authentication successful",
  "data": {"accessToken": "eyJhbGciOi..."}
}
```

The code is a JWT signed with a key derived from `jwtSecret`, with audience `sso-exchange`, a 60-second lifetime, and the provider and subject bound into the payload. It cannot be used as an access token.

The exchange returns `401 Invalid or expired code` when the code is malformed, expired, issued for another provider, or references a deleted user.

## Failure handling

| Condition | `error` parameter |
| --- | --- |
| State cookie missing | `missing_state` |
| State cookie invalid, expired, or state mismatch | `invalid_state` |
| Token or Userinfo request failed, or no subject returned | `provider_error` |
| The user row could not be created or read | `user_resolution_failed` |
| Authentication is no longer enabled | `not_configured` |

With `redirectUrl` configured, ROSS redirects to `failureRedirectUrl` (or `redirectUrl` when no failure URL is set) with `?error=<reason>`. Without `redirectUrl`, it returns `400 SSO authentication failed`. The original error is never exposed to the browser.

```json
{
  "config": {
    "redirectUrl": "https://app.example.com/done",
    "failureRedirectUrl": "https://app.example.com/login?provider=github"
  }
}
```

## Provider examples

### GitHub

```json
{
  "type": "sso",
  "name": "github",
  "protocol": "oauth2",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "authorizeUrl": "https://github.com/login/oauth/authorize",
    "tokenUrl": "https://github.com/login/oauth/access_token",
    "userInfoUrl": "https://api.github.com/user",
    "idClaim": "id",
    "clientId": "env:GITHUB_CLIENT_ID",
    "clientSecret": "env:GITHUB_CLIENT_SECRET",
    "scopes": ["read:user"],
    "callbackUrl": "https://api.example.com/api/v1/auth/sso/github/callback"
  }
}
```

GitHub returns numeric IDs; ROSS converts them to strings for `provider_id`. If you need the primary email, request the `user:email` scope and point `userInfoUrl` at an endpoint that returns it, or map only the profile fields GitHub exposes.

### Generic authorization server

```json
{
  "type": "sso",
  "name": "acme",
  "protocol": "oauth2",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "authorizeUrl": "https://auth.acme.com/oauth/authorize",
    "tokenUrl": "https://auth.acme.com/oauth/token",
    "userInfoUrl": "https://auth.acme.com/api/me",
    "idClaim": "user_id",
    "clientId": "env:ACME_CLIENT_ID",
    "clientSecret": "env:ACME_CLIENT_SECRET",
    "scopes": ["profile", "email"],
    "attributeMapping": {
      "name": "display_name",
      "email": "email"
    }
  }
}
```

If the provider publishes an OpenID Connect discovery document, prefer the [OIDC provider](./oidc.md) instead: it adds PKCE, nonce validation, and signing-key discovery.

## API policy

The SSO routes use the API policy identifiers below:

| Operation | Identifier |
| --- | --- |
| Discovery | `auth.v1.users.unknown.providers` |
| Login | `auth.v1.users.unknown.ssoLogin` |
| Callback | `auth.v1.users.unknown.ssoCallback` |
| Token exchange | `auth.v1.users.unknown.ssoToken` |

```json
{
  "apis": {
    "auth.v1.users.unknown.ssoLogin": {"enabled": false}
  }
}
```

## Security notes

- The client secret is never sent to the browser and is redacted from printed configuration.
- The state payload is encrypted, not merely signed, so it cannot be read client-side.
- Redirect targets are configuration values only. ROSS never accepts a `returnTo` or `redirect` value from the request, so an open-redirect allow-list is unnecessary.
- The authorization code is exchanged only after state validation, and the exchanged access token is never stored or returned.
- A provider name must be unique and cannot shadow an existing auth route segment.
