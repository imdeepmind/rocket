---
sidebar_position: 5
---

# SAML 2.0

The `sso` provider with `"protocol": "saml"` implements **SP-initiated SAML 2.0**. ROSS acts as the service provider: it sends an `AuthnRequest` to the identity provider, receives the assertion at its Assertion Consumer Service (ACS), validates it, and maps the `NameID` to a local user row. The result is the standard JWT access token.

SAML is the right choice for enterprise identity providers that do not expose OAuth2 or OIDC — for example, a corporate Active Directory Federation Services or a SAML-only Okta/OneLogin tenant.

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
        "name": "corp",
        "protocol": "saml",
        "config": {
          "fields": {"providerIdField": "provider_id"},
          "entryPoint": "https://idp.example.com/saml2/sso",
          "issuer": "https://api.example.com/saml/corp",
          "cert": "env:SAML_IDP_CERT",
          "attributeMapping": {
            "mail": "email",
            "displayName": "display_name"
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
| `protocol` | `"saml"` | **Yes** | — | Selects this adapter. |
| `config.fields.providerIdField` | `string` | **Yes** | — | String column that stores the assertion `NameID` together with `providerField`. |
| `config.fields.usernameField` | `string` | No | — | Optional string column (e.g. `"email"`) to persist the user's username/email from the IdP. When set, ROSS prevents account collision if an account with that username already exists. |
| `config.entryPoint` | `string` | **Yes** | — | Identity provider SSO URL. The `AuthnRequest` is sent here. |
| `config.issuer` | `string` | **Yes** | — | Service provider entity ID. It is also used as the expected assertion audience. |
| `config.cert` | `string` | **Yes** | — | Identity provider X.509 signing certificate (PEM body or base64). |
| `config.attributeMapping` | `object` | No | `{}` | Map of SAML attribute name to model column. |
| `config.callbackUrl` | `string` | No | Derived per request | Absolute ACS URL. Must end with `/auth/sso/<name>/callback`. |
| `config.redirectUrl` | `string` | No | — | Frontend landing page after a successful login. When absent, the ACS returns JSON. |
| `config.failureRedirectUrl` | `string` | No | `redirectUrl` | Frontend landing page after a failed login. Requires `redirectUrl`. |

All URLs must be absolute and use `https`; plain `http` is accepted only for `localhost` and `127.0.0.1`.

### Identity provider settings

Configure these values in the identity provider:

| Setting | Value |
| --- | --- |
| ACS / reply URL | `https://api.example.com/api/v1/auth/sso/corp/callback` |
| Audience / SP entity ID | The configured `issuer` (for example `https://api.example.com/saml/corp`) |
| NameID format | Any stable identifier. It becomes `provider_id`. |
| Signed assertions | **Required** |

ROSS publishes its service provider metadata so the identity provider can import these values automatically:

```http
GET /api/v1/auth/sso/corp/metadata
```

The response is an XML document containing the entity ID and ACS URL. When `callbackUrl` is omitted, the ACS URL in the metadata is derived from the request host that fetched the metadata, so fetch it from the public hostname.

### Callback URL

`callbackUrl` is the ACS URL. When omitted, ROSS derives it from the request:

```text
https://api.example.com/api/v1/auth/sso/corp/callback
```

The path is the login route with `/login` replaced by `/callback`, or the metadata route with `/metadata` replaced by `/callback`. Set it explicitly when the public host differs from the request host.

## Routes

| Method | Path | Content type | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/auth/sso/corp/login` | — | Sends the `AuthnRequest` and redirects to the IdP |
| `POST` | `/api/v1/auth/sso/corp/callback` | `application/x-www-form-urlencoded` | Assertion Consumer Service |
| `GET` | `/api/v1/auth/sso/corp/metadata` | `application/xml` | Service provider metadata |
| `POST` | `/api/v1/auth/sso/corp/token` | `application/json` | Exchanges a one-time code (only with `redirectUrl`) |
| `GET` | `/api/v1/auth/providers` | — | Lists configured providers (shared by all identity providers) |

## Flow

```text
1. Browser  GET  /auth/sso/corp/login
2. ROSS     302  https://idp.example.com/saml2/sso?SAMLRequest=...&RelayState=...
3. IdP      authenticates the user, then POSTs the ACS URL
4. Browser  POST /auth/sso/corp/callback
                 Content-Type: application/x-www-form-urlencoded
                 SAMLResponse=<base64 assertion>&RelayState=...
5. ROSS     validate signature, audience, conditions, and InResponseTo
6. ROSS     find-or-create the local user for (corp, NameID)
7. ROSS     200  {"accessToken": "..."}   or   302 <redirectUrl>?code=<one-time code>
```

### 1. Start the flow

`GET /api/v1/auth/sso/corp/login` builds a SAML `AuthnRequest` and redirects the browser to `entryPoint`. The `RelayState` carries the correlation value.

### 2. Receive the assertion

The ACS is a **cross-site form POST** from the identity provider. ROSS accepts it as `application/x-www-form-urlencoded` and validates the assertion before using it:

- The assertion signature is verified against `cert`.
- The assertion audience matches `issuer`.
- The assertion conditions (not-before / not-on-or-after) are satisfied.
- `InResponseTo` matches a request ID that ROSS issued for this provider.

If any check fails, no user is resolved and no token is issued.

:::note[Cookie correlation is not used for SAML]

The login route still sets the usual `__Host-ross_sso_<name>` cookie, but the ACS does not depend on it. A `SameSite=Lax` cookie is not sent on a cross-site POST, so correlation is handled by the cache-backed `InResponseTo` check instead.

:::

## Identity resolution

The subject is the assertion `NameID`. ROSS looks up:

```sql
SELECT * FROM "users" WHERE "provider" = 'corp' AND "provider_id" = 'user-1' LIMIT 1;
```

If no row exists, it inserts one with `provider = "corp"`, `provider_id = <NameID>`, and every mapped SAML attribute that is present and not `null`:

```json
{
  "attributeMapping": {
    "mail": "email",
    "displayName": "display_name"
  }
}
```

The mapping keys are the attribute names the identity provider releases; use the same names configured in the IdP's attribute statements. A mapping never overwrites the identity columns, and a concurrent first login is recovered by re-reading the row.

No email or username is required for SAML accounts.

## Token handoff

The handoff is identical for every SSO protocol.

### JSON mode

Without `redirectUrl`, the ACS responds with the token:

```json
{
  "code": 200,
  "message": "SSO authentication successful",
  "data": {"accessToken": "eyJhbGciOi..."}
}
```

### Redirect mode

With `redirectUrl`, ROSS returns `302` to your frontend with a one-time code:

```http
HTTP/1.1 302 Found
Location: https://app.example.com/done?code=eyJhbGciOi...
```

```http
POST /api/v1/auth/sso/corp/token
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

The code is a JWT signed with an HKDF-derived key (audience `sso-exchange`), expires after 60 seconds, and is bound to the provider and subject. It cannot be used as an access token.

## Failure handling

| Condition | `error` parameter |
| --- | --- |
| `SAMLResponse` missing from the ACS body | `provider_error` |
| Signature, audience, conditions, or `InResponseTo` invalid | `provider_error` |
| Response is a logout response or has no `NameID` | `provider_error` |
| The user row could not be created or read | `user_resolution_failed` |

With `redirectUrl`, ROSS redirects to `failureRedirectUrl` (or `redirectUrl`) with `?error=<reason>`. Without it, the ACS returns `400 SSO authentication failed`. The underlying assertion error is never exposed to the browser.

:::danger[Use a shared cache for SAML]

`InResponseTo` validation stores issued request IDs in `infrastructure.cache` for 10 minutes. The default in-memory cache is process-local, so in a multi-instance deployment an ACS POST can land on an instance that never saw the login request and validation will fail. Configure Redis or Memcached whenever more than one instance can receive SAML traffic.

:::

## Provider examples

### Okta

```json
{
  "type": "sso",
  "name": "okta",
  "protocol": "saml",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "entryPoint": "https://acme.okta.com/app/acme_ross/sso/saml",
    "issuer": "https://api.example.com/saml/okta",
    "cert": "env:OKTA_SAML_CERT",
    "attributeMapping": {
      "email": "email",
      "firstName": "first_name",
      "lastName": "last_name"
    }
  }
}
```

### Microsoft Entra ID

```json
{
  "type": "sso",
  "name": "entra",
  "protocol": "saml",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "entryPoint": "https://login.microsoftonline.com/<tenant-id>/saml2",
    "issuer": "https://api.example.com/saml/entra",
    "cert": "env:ENTRA_SAML_CERT",
    "attributeMapping": {
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "email",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "display_name"
    }
  }
}
```

Entra ID uses full claim URIs as attribute names. Use them verbatim in `attributeMapping`.

### OneLogin

```json
{
  "type": "sso",
  "name": "onelogin",
  "protocol": "saml",
  "config": {
    "fields": {"providerIdField": "provider_id"},
    "entryPoint": "https://acme.onelogin.com/trust/saml2/http-post/sso/<app-id>",
    "issuer": "https://api.example.com/saml/onelogin",
    "cert": "env:ONELOGIN_SAML_CERT"
  }
}
```

## API policy

| Operation | Identifier |
| --- | --- |
| Discovery | `auth.v1.users.unknown.providers` |
| Login | `auth.v1.users.unknown.ssoLogin` |
| ACS callback | `auth.v1.users.unknown.ssoCallback` |
| Metadata | `auth.v1.users.unknown.ssoMetadata` |
| Token exchange | `auth.v1.users.unknown.ssoToken` |

```json
{
  "apis": {
    "auth.v1.users.unknown.ssoMetadata": {"enabled": false}
  }
}
```

Disabling the metadata route does not disable the ACS; disable `ssoCallback` if you need to turn the flow off entirely.

## Security notes

- Assertions must be signed. ROSS verifies the signature with the configured IdP certificate.
- Audience and assertion conditions are validated on every response.
- `InResponseTo` is always validated and is never relaxed.
- ROSS sends unsigned `AuthnRequest`s. If your identity provider requires signed requests, it is not compatible with this adapter.
- The IdP certificate is redacted from printed configuration.
- Redirect targets are configuration values only; client-supplied redirects are ignored.
