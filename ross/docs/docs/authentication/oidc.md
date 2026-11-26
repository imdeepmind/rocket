---
sidebar_position: 4
---

# OpenID Connect

The `sso` provider with `"protocol": "oidc"` is the recommended choice for any identity provider that publishes an OpenID Connect discovery document: Google, Okta, Auth0, Keycloak, Microsoft Entra ID, and most enterprise identity platforms.

ROSS discovers the provider's endpoints and signing keys from `{issuerUrl}/.well-known/openid-configuration`, then runs the authorization code flow with **PKCE (`S256`)** and **nonce** validation. The local identity is taken from the validated ID token, and the result is the standard JWT access token.

## Configuration

```json
{
  "authentication": {
    "enabled": true,
    "jwtSecret": "env:JWT_SECRET",
    "accessTokenExpiration": "15m",
    "refreshTokenExpiration": "7d",
    "sessionStorage": "db",
    "userModel": {
      "modelName": "users",
      "idField": "id",
      "providerField": "provider"
    },
    "providers": [
      {
        "type": "sso",
        "name": "google",
        "protocol": "oidc",
        "config": {
          "fields": {"providerIdField": "provider_id"},
          "issuerUrl": "https://accounts.google.com",
          "clientId": "env:GOOGLE_CLIENT_ID",
          "clientSecret": "env:GOOGLE_CLIENT_SECRET",
          "scopes": ["openid", "profile", "email"],
          "attributeMapping": {
            "email": "email",
            "name": "display_name"
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
| `protocol` | `"oidc"` | **Yes** | — | Selects this adapter. |
| `config.fields.providerIdField` | `string` | **Yes** | — | String column that stores the subject together with `providerField`. |
| `config.fields.usernameField` | `string` | No | — | Optional string column (e.g. `"email"`) to persist the user's username/email from the IdP. When set, ROSS prevents account collision if an account with that username already exists. |
| `config.issuerUrl` | `string` | **Yes** | — | Issuer identifier. ROSS fetches `{issuerUrl}/.well-known/openid-configuration` from it. |
| `config.clientId` | `string` | **Yes** | — | OIDC client identifier. |
| `config.clientSecret` | `string` | **Yes** | — | OIDC client secret. |
| `config.scopes` | `string[]` | No | `["openid", "profile"]` | Scopes joined with spaces. Add `email` to receive the email claim. |
| `config.attributeMapping` | `object` | No | `{}` | Map of **ID token claim** name to model column. |
| `config.callbackUrl` | `string` | No | Derived per request | Absolute URL registered with the provider. Must end with `/auth/sso/<name>/callback`. |
| `config.redirectUrl` | `string` | No | — | Frontend landing page after a successful login. When absent, the callback returns JSON. |
| `config.failureRedirectUrl` | `string` | No | `redirectUrl` | Frontend landing page after a failed login. Requires `redirectUrl`. |

All URLs must be absolute and use `https`; plain `http` is accepted only for `localhost` and `127.0.0.1`.

OIDC config does **not** accept `authorizeUrl`, `tokenUrl`, `userInfoUrl`, or `idClaim`. Those values come from discovery, and unknown keys are rejected.

### Callback URL

Register this exact redirect URI at the identity provider:

```text
https://api.example.com/api/v1/auth/sso/google/callback
```

When `callbackUrl` is omitted, ROSS derives it per request from the login route, replacing `/login` with `/callback`. Set it explicitly when the public host differs from the request host, or when the provider requires a pre-registered value.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/auth/sso/google/login` | Starts discovery, sets state, redirects to the provider |
| `GET` | `/api/v1/auth/sso/google/callback` | Validates the response and completes login |
| `POST` | `/api/v1/auth/sso/google/token` | Exchanges a one-time code for an access token (only with `redirectUrl`) |
| `GET` | `/api/v1/auth/providers` | Lists configured providers (shared by all identity providers) |

## Flow

```text
1. Browser  GET  /auth/sso/google/login
2. ROSS     GET  https://accounts.google.com/.well-known/openid-configuration   (cached)
3. ROSS     302  https://accounts.google.com/o/oauth2/v2/auth
                 ?redirect_uri=...&scope=openid profile email&state=...
                 &nonce=...&code_challenge=...&code_challenge_method=S256
                 Set-Cookie: __Host-ross_sso_google=<sealed state incl. code_verifier>
4. Provider 302  /auth/sso/google/callback?code=...&state=...
5. ROSS     POST token endpoint with code + PKCE verifier
6. ROSS     validate ID token signature, issuer, audience, nonce, and state
7. ROSS     find-or-create the local user for (google, sub)
8. ROSS     200  {"accessToken": "...", "refreshToken": "..."}   or   302 <redirectUrl>?code=<one-time code>
```

### 1. Discovery and authorization

On the first login for a given `(name, issuerUrl)` pair, ROSS downloads the discovery document and memoizes the resulting configuration for the lifetime of the process. Signing keys are handled by the OpenID client library. A failed discovery is not cached, so the next login retries it.

The authorization request includes:

- `redirect_uri` — the resolved callback URL.
- `scope` — configured scopes, default `openid profile`.
- `state` — random value echoed back by the provider.
- `nonce` — random value bound into the ID token.
- `code_challenge` and `code_challenge_method=S256`.

The PKCE `code_verifier` never leaves the server: it lives inside the sealed state cookie.

### 2. Callback validation

ROSS re-validates all of the following before a user is resolved:

- The sealed state cookie exists, decrypts, and has not expired (10 minutes).
- The `state` query parameter matches the sealed value (constant-time comparison).
- The provider returns to the expected callback URL.
- The ID token signature, issuer, audience, expiry, `state`, and `nonce` are valid.

Failure at any step follows the [failure behaviour](#failure-handling) and never issues a token.

## Identity resolution

The subject is the ID token `sub` claim. ROSS looks up:

```sql
SELECT * FROM "users" WHERE "provider" = 'google' AND "provider_id" = '1234567890' LIMIT 1;
```

If no row exists, it inserts one with `provider = "google"`, `provider_id = <sub>`, and every mapped claim that is present and not `null`:

```json
{
  "attributeMapping": {
    "email": "email",
    "name": "display_name"
  }
}
```

Only **ID token claims** are available for mapping. To receive the email claim, include the `email` scope; to receive profile claims, include `profile`. A mapping never overwrites the identity columns, and a concurrent first login is recovered by re-reading the row.

No email or username is required for SSO accounts. If you want password login to coexist with SSO, the credential columns must be nullable — see [Password authentication](./up-auth.md#combining-with-sso).

## Token handoff

The handoff is identical for every SSO protocol.

### JSON mode

Without `redirectUrl`, the callback returns the token directly:

```json
{
  "code": 200,
  "message": "SSO authentication successful",
  "data": {"accessToken": "eyJhbGciOi...", "refreshToken": "xK9..."}
}
```

### Redirect mode

With `redirectUrl`, the browser is sent to your frontend with a one-time code:

```http
HTTP/1.1 302 Found
Location: https://app.example.com/done?code=eyJhbGciOi...
```

```http
POST /api/v1/auth/sso/google/token
Content-Type: application/json

{"code": "eyJhbGciOi..."}
```

```json
{
  "code": 200,
  "message": "SSO authentication successful",
  "data": {"accessToken": "eyJhbGciOi...", "refreshToken": "xK9..."}
}
```

The code is a JWT signed with an HKDF-derived key (audience `sso-exchange`), expires after 60 seconds, and is bound to both the provider and the subject. It cannot be presented as an access token. An expired, tampered, cross-provider, or orphaned code returns `401 Invalid or expired code`.

## Failure handling

| Condition | `error` parameter |
| --- | --- |
| State cookie missing | `missing_state` |
| State cookie invalid, expired, or state mismatch | `invalid_state` |
| Discovery, token exchange, or ID token validation failed | `provider_error` |
| The user row could not be created or read | `user_resolution_failed` |
| Authentication is no longer enabled | `not_configured` |

With `redirectUrl`, ROSS redirects to `failureRedirectUrl` (or `redirectUrl`) with `?error=<reason>`. Without it, the callback returns `400 SSO authentication failed`.

## Provider examples

### Google

```json
{
  "type": "sso",
  "name": "google",
  "protocol": "oidc",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "issuerUrl": "https://accounts.google.com",
    "clientId": "env:GOOGLE_CLIENT_ID",
    "clientSecret": "env:GOOGLE_CLIENT_SECRET",
    "scopes": ["openid", "profile", "email"],
    "attributeMapping": {"email": "email", "name": "display_name"}
  }
}
```

### Okta

```json
{
  "type": "sso",
  "name": "okta",
  "protocol": "oidc",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "issuerUrl": "https://acme.okta.com",
    "clientId": "env:OKTA_CLIENT_ID",
    "clientSecret": "env:OKTA_CLIENT_SECRET",
    "scopes": ["openid", "profile", "email"]
  }
}
```

Some Okta organizations use an authorization-server-specific issuer such as `https://acme.okta.com/oauth2/default`. Use the issuer printed by the authorization server; the discovery document must be reachable at `{issuerUrl}/.well-known/openid-configuration`.

### Keycloak

```json
{
  "type": "sso",
  "name": "keycloak",
  "protocol": "oidc",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "issuerUrl": "https://sso.example.com/realms/acme",
    "clientId": "env:KEYCLOAK_CLIENT_ID",
    "clientSecret": "env:KEYCLOAK_CLIENT_SECRET",
    "scopes": ["openid", "profile", "email"]
  }
}
```

### Auth0

```json
{
  "type": "sso",
  "name": "auth0",
  "protocol": "oidc",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "issuerUrl": "https://acme.eu.auth0.com/",
    "clientId": "env:AUTH0_CLIENT_ID",
    "clientSecret": "env:AUTH0_CLIENT_SECRET",
    "scopes": ["openid", "profile", "email"]
  }
}
```

## API policy

| Operation | Identifier |
| --- | --- |
| Discovery | `auth.v1.users.unknown.providers` |
| Login | `auth.v1.users.unknown.ssoLogin` |
| Callback | `auth.v1.users.unknown.ssoCallback` |
| Token exchange | `auth.v1.users.unknown.ssoToken` |

```json
{
  "apis": {
    "auth.v1.users.unknown.ssoToken": {"enabled": false}
  }
}
```

## Security notes

- PKCE prevents authorization-code interception. The verifier is stored only in the encrypted state cookie.
- The nonce binds the ID token to the browser flow that started it.
- The ID token is validated against the provider's published signing keys, issuer, and audience.
- The state cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed, and expires after 10 minutes.
- Redirect targets are configuration values only; client-supplied redirects are ignored.
- `clientSecret` is redacted from printed configuration and never sent to the browser.
