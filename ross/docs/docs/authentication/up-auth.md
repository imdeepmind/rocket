---
sidebar_position: 2
---

# Password Authentication (`up-auth`)

The `up-auth` provider gives a ROSS application local accounts: users register with a username and password, log in with those credentials, and receive the same JWT access token that SSO providers issue. Passwords are hashed with bcrypt using 10 salt rounds and are never returned by an endpoint.

This is the only provider that owns a password. It also provides registration, password change, password reset, optional email verification, and optional email MFA. It can run alone or alongside any number of [SSO providers](./introduction.md#supported-providers).

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
        "type": "up-auth",
        "config": {
          "fields": {
            "usernameField": "email",
            "passwordField": "password"
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
| `type` | `"up-auth"` | **Yes** | — | Provider identifier. |
| `config.fields.usernameField` | `string` | **Yes** | — | Model column used as the login identifier. It is also the address OTP emails are sent to. |
| `config.fields.passwordField` | `string` | **Yes** | — | Model column that stores the bcrypt hash. Mark it `"secret": true`. |
| `config.fields.isVerifiedField` | `string` | No | — | Boolean model column used for email verification. When set, registration starts unverified and login rejects unverified users. Requires `integrations.email`. |
| `config.mfaRequired` | `boolean` | No | `false` | Sends an OTP after a correct password and withholds the access token until the OTP is verified. Requires `integrations.email`. |

Additional rules enforced at startup:

- At most one `up-auth` provider is allowed.
- `userModel` and `jwtSecret` are required.
- `usernameField` and `passwordField` must exist in the user model and be of type `string`.
- When no SSO provider is configured, `usernameField` must be unique (`unique: true` or unique index) and not nullable (`nullable: false`), and `passwordField` must not be nullable (`nullable: false`).
- When an SSO provider is configured in the same application, `passwordField` must be `nullable: true` (and `usernameField` must be `nullable: true` unless mapped/provided), because SSO accounts do not have passwords.
- `isVerifiedField` must exist, must be of type `boolean`, and requires `integrations.email`.
- `mfaRequired: true` requires `integrations.email`.

### Where the provider column comes from

Registration writes `"up-auth"` into `userModel.providerField` when the client did not supply it. This is what lets ROSS distinguish password accounts from SSO accounts later. Every row created by this provider should therefore keep that value.

## Routes

All routes are mounted under the API prefix and variant, so the default base path is `/api/v1`.

| Method | Path | Auth required | Available when |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | No | `up-auth` configured |
| `POST` | `/api/v1/auth/login` | No | `up-auth` configured |
| `POST` | `/api/v1/auth/login/verify/otp` | No | `mfaRequired: true` |
| `POST` | `/api/v1/auth/login/resend/otp` | No | `mfaRequired: true` |
| `POST` | `/api/v1/auth/register/verify/otp` | No | `isVerifiedField` set |
| `POST` | `/api/v1/auth/register/resend/otp` | No | `isVerifiedField` set |
| `POST` | `/api/v1/auth/forgot-password` | No | `integrations.email` |
| `POST` | `/api/v1/auth/forgot-password/verify/otp` | No | `integrations.email` |
| `POST` | `/api/v1/auth/forgot-password/resend/otp` | No | `integrations.email` |
| `POST` | `/api/v1/auth/change-password` | Bearer JWT | `up-auth` configured |
| `PATCH` | `/api/v1/auth/user/email` | Bearer JWT | `isVerifiedField` set |
| `GET` | `/api/v1/auth/user/me` | Bearer JWT | `up-auth` configured |
| `PATCH` | `/api/v1/auth/user/me` | Bearer JWT | `up-auth` configured |
| `DELETE` | `/api/v1/auth/user/me` | Bearer JWT | `up-auth` configured |

All responses use the standard envelope `{code, message, data}`.

## Registration

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "p@ssw0rd",
  "display_name": "Alice"
}
```

The request body is generated from the user model:

- The primary key and managed timestamp columns are excluded.
- Every non-nullable field without a default is required.
- Unknown properties are rejected.
- When `isVerifiedField` is configured, that column is removed from the accepted body and forced to `false`.
- The password is hashed before the row is inserted.

Success (no verification configured):

```json
{
  "code": 201,
  "message": "Successfully registered a new user in the users table",
  "data": {
    "email": "alice@example.com",
    "display_name": "Alice",
    "provider": "up-auth"
  }
}
```

Success with `isVerifiedField` configured:

```json
{
  "code": 201,
  "message": "Registration successful. OTP sent to your email.",
  "data": {"requiresMfa": true, "ulid": "01J..."}
}
```

The `ulid` identifies the OTP transaction and is required by `POST /auth/register/verify/otp`.

## Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email": "alice@example.com", "password": "p@ssw0rd"}
```

The body accepts exactly the two configured fields; any additional property is rejected.

### Without MFA

```json
{
  "code": 200,
  "message": "Login successful",
  "data": {"accessToken": "eyJhbGciOi..."}
}
```

The token payload contains `id`, the username claim (`email` in this example), and RBAC claims when RBAC is enabled.

### With MFA

When `mfaRequired` is `true`, a correct password does **not** return a token. It returns an OTP challenge:

```json
{
  "code": 200,
  "message": "Login successful. OTP sent to your email.",
  "data": {"requiresMfa": true, "ulid": "01J..."}
}
```

Complete the login with `POST /auth/login/verify/otp` and the `ulid`, `otp`, and username.

### Login errors

| Status | Message | Cause |
| --- | --- | --- |
| `400` | `Password management is not supported for accounts authenticated via <provider>...` | The matched row belongs to an SSO provider. |
| `401` | `Invalid username or password` | Unknown user or wrong password. |
| `401` | `User is not verified` | `isVerifiedField` is set and the column is not `true`. |
| `400` | Schema validation message | Missing or unknown body properties. |

The handler compares against a dummy hash when the user does not exist, so response timing does not reveal whether an account is registered.

## Verifying an OTP

```http
POST /api/v1/auth/login/verify/otp
Content-Type: application/json

{"ulid": "01J...", "otp": "123456", "email": "alice@example.com"}
```

```json
{
  "code": 200,
  "message": "OTP verification successful",
  "data": {"accessToken": "eyJhbGciOi..."}
}
```

The same route behaviour is used for the three OTP flows:

| Route | Action | Body |
| --- | --- | --- |
| `POST /auth/login/verify/otp` | Completes login and returns `accessToken` | `ulid`, `otp`, username |
| `POST /auth/register/verify/otp` | Marks the account verified, returns `data: null` | `ulid`, `otp`, username |
| `POST /auth/forgot-password/verify/otp` | Sets the new password, returns `{success: true}` | `ulid`, `otp`, username, `newPassword` |

An invalid or unknown OTP returns `401 Invalid or expired OTP`. A verified OTP is deleted from the cache and cannot be replayed.

## Resending an OTP

```http
POST /api/v1/auth/login/resend/otp
Content-Type: application/json

{"email": "alice@example.com"}
```

Every resend route returns the same shape:

```json
{
  "code": 200,
  "message": "OTP resent to your email.",
  "data": {"requiresMfa": true, "ulid": "01J..."}
}
```

| Route | Used for |
| --- | --- |
| `POST /auth/login/resend/otp` | MFA login |
| `POST /auth/register/resend/otp` | Registration verification |
| `POST /auth/forgot-password/resend/otp` | Password reset |

If the username does not match a row, the route returns `404 User not found`.

## Forgot password

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{"email": "alice@example.com"}
```

```json
{
  "code": 200,
  "message": "OTP sent to your email.",
  "data": {"requiresMfa": true, "ulid": "01J..."}
}
```

Then submit the OTP and the replacement password:

```http
POST /api/v1/auth/forgot-password/verify/otp
Content-Type: application/json

{
  "ulid": "01J...",
  "otp": "123456",
  "email": "alice@example.com",
  "newPassword": "new-p@ssw0rd"
}
```

```json
{
  "code": 200,
  "message": "OTP verification successful",
  "data": {"success": true}
}
```

Forgot-password is available only when `integrations.email` is configured, and it rejects SSO-owned rows with the same `400` guardrail as login.

:::warning[OTPs need a shared cache in production]

OTP codes are stored in `infrastructure.cache` for 10 minutes. The default in-memory engine is process-local, so a multi-instance deployment must use Redis or Memcached or OTP verification will fail whenever the follow-up request hits another instance. ROSS logs a warning at startup when this is the case.

:::

## Change password

```http
POST /api/v1/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{"existingPassword": "p@ssw0rd", "newPassword": "new-p@ssw0rd"}
```

```json
{
  "code": 200,
  "message": "Password changed successfully",
  "data": {"success": true}
}
```

| Status | Message | Cause |
| --- | --- | --- |
| `400` | Password-management guardrail message | The account belongs to an SSO provider. |
| `401` | `Invalid existing password` | The supplied current password does not match. |
| `404` | `User not found` | The token references a deleted user. |

The route always requires a bearer token, independently of the `apis` authorization setting.

## Change email

Available only when `fields.isVerifiedField` is configured. It updates the email column, marks the account unverified, and sends an OTP to the new address:

```http
PATCH /api/v1/auth/user/email
Authorization: Bearer <token>
Content-Type: application/json

{"email": "new-address@example.com"}
```

```json
{
  "code": 200,
  "message": "Email updated. OTP sent to your new email.",
  "data": {"requiresMfa": true, "ulid": "01J..."}
}
```

Because the account is now unverified, the user cannot log in again until the new address is confirmed. Submit the OTP through `POST /auth/register/verify/otp` with the **new** address; that flow sets `isVerifiedField` back to `true`.

The route rejects SSO-owned accounts and requires a bearer token.

## Account management

These three routes are registered when the `up-auth` provider is configured. In a mixed deployment they also operate on SSO-owned rows, so SSO users can read, edit, and delete their own profile.

### Get the current profile

```http
GET /api/v1/auth/user/me
Authorization: Bearer <token>
```

Returns the public columns of the row identified by `request.user.id`. Columns marked `"secret": true` are excluded unless the API policy sets `bypassSecret`.

| Status | Message |
| --- | --- |
| `200` | `User profile retrieved successfully` |
| `401` | `User ID missing in token payload` |
| `404` | `User not found` |

### Edit the current profile

```http
PATCH /api/v1/auth/user/me
Authorization: Bearer <token>
Content-Type: application/json

{"display_name": "Alice Smith"}
```

The accepted body is generated from the model with these columns removed:

- the primary key (`idField`)
- the username column (`usernameField`)
- the password column (`passwordField`)
- the verification column (`isVerifiedField`, when configured)
- managed timestamp columns

An empty body returns `400 No editable fields provided`. Success returns the updated fields:

```json
{
  "code": 200,
  "message": "User profile updated successfully",
  "data": {"display_name": "Alice Smith"}
}
```

### Delete the current profile

```http
DELETE /api/v1/auth/user/me
Authorization: Bearer <token>
```

```json
{
  "code": 200,
  "message": "User profile deleted successfully",
  "data": {"success": true}
}
```

Deletion runs inside a transaction. The row is removed permanently; ROSS does not soft-delete accounts.

## Token contents

```json
{
  "id": 42,
  "email": "alice@example.com",
  "role": "admin",
  "iat": 1730000000,
  "exp": 1730086400
}
```

| Claim | Source |
| --- | --- |
| `id` | `userModel.idField` |
| `<usernameField>` | The username column, when it has a value |
| `role` | `rbac.roleField` when RBAC is enabled and the value is a scalar |
| `roles` | `rbac.roleField` when the value is an array or a JSON-encoded array |
| `iat`, `exp` | Issued-at and `tokenExpiration` |

## Full example with MFA and verification

```json
{
  "integrations": {
    "email": {
      "provider": "sendgrid",
      "config": {
        "apiKey": "env:SENDGRID_API_KEY",
        "fromEmail": "noreply@example.com"
      }
    }
  },
  "authentication": {
    "enabled": true,
    "jwtSecret": "env:JWT_SECRET",
    "tokenExpiration": "8h",
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
            "passwordField": "password",
            "isVerifiedField": "is_active"
          },
          "mfaRequired": true
        }
      }
    ]
  }
}
```

With this configuration a user must:

1. Register and verify the email through `POST /auth/register/verify/otp`.
2. Log in with the password and receive an OTP challenge.
3. Verify the OTP through `POST /auth/login/verify/otp` to receive the access token.

## Combining with SSO

Password login and SSO can coexist. Make the credential columns nullable and let `providerField` distinguish the accounts:

```json
{
  "authentication": {
    "enabled": true,
    "jwtSecret": "env:JWT_SECRET",
    "userModel": {
      "modelName": "users",
      "idField": "id",
      "providerField": "provider"
    },
    "providers": [
      {
        "type": "up-auth",
        "config": {
          "fields": {"usernameField": "email", "passwordField": "password"}
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

SSO users are created with `provider: "google"` and no email or password. Password operations against those rows are rejected with the guardrail message described in the [introduction](./introduction.md#sso-accounts-and-password-routes).

## Disabling individual routes

Password routes use the API policy identifiers `auth.<variant>.<userModel>.unknown.<operation>`:

| Operation | Identifier |
| --- | --- |
| Registration | `auth.v1.users.unknown.registration` |
| Login | `auth.v1.users.unknown.login` |
| Change password | `auth.v1.users.unknown.changePassword` |
| Forgot password | `auth.v1.users.unknown.forgotPassword` |
| OTP verify (login) | `auth.v1.users.unknown.otpVerifyLogin` |
| OTP verify (registration) | `auth.v1.users.unknown.otpVerifyRegister` |
| Email change | `auth.v1.users.unknown.emailChange` |
| Current profile | `auth.v1.users.unknown.me` |
| Edit profile | `auth.v1.users.unknown.editMe` |
| Delete profile | `auth.v1.users.unknown.deleteMe` |

```json
{
  "apis": {
    "auth.v1.users.unknown.registration": {"enabled": false}
  }
}
```

Disabling a route returns `404 Not Found`; it does not weaken the routes that remain.
