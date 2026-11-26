# Rocket auth examples

A suite of runnable examples — one per authentication mode that Rocket
supports. Pick the one closest to your use case; each is a self-contained
config with copy-pasteable `curl` calls in its README.

| Directory                                        | Provider  | Login identifier | Extra config                                               | Flow                                                                       |
| ------------------------------------------------ | --------- | ---------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`username-password`](./username-password)       | `up-auth` | `username`       | —                                                          | register → login → bearer token → per-user scoped notes                    |
| [`email-otp`](./email-otp)                       | `up-auth` | `email`          | `isVerifiedField`, `integrations.email`                    | register → OTP verify → login → bearer token; forgot-password + resends    |
| [`email-mfa`](./email-mfa)                       | `up-auth` | `email`          | `isVerifiedField` + `mfaRequired`, `integrations.email`, `cache` | register → verify → login → login OTP verify → bearer token                |
| [`api-key`](./api-key)                           | `api-key` | n/a              | `provider.config.key`                                      | `x-api-key` header on protected routes; no user model, no JWT              |

## Shared conventions

- **SQLite only.** Each example uses its own SQLite file
  (`./examples/auth/<mode>/database.db`), so they never share data. One
  exception: the `email-mfa` example also needs a running Redis, because
  config validation currently requires a `cache` block when `mfaRequired` is
  true. Without a cache block the OTP cache falls back to an in-memory cache.
- **No network.** Emails (OTPs) use the `dummy` provider, which only logs to
  the server stdout — no SMTP or real emails are involved.
- **Env-var-backed secrets.** Secrets are referenced as `env:JWT_SECRET`
  (used by the three JWT examples) or `env:API_KEY` (used by the api-key
  example) and resolved from the environment at startup.
- **One config per run.** Each example's `config.json` is self-contained.
- **No extra npm dependencies.** Everything runs with the project's own
  dependencies.

## Running an example

From the repository root:

```bash
# JWT-based examples (username-password, email-otp, email-mfa)
export JWT_SECRET='example-jwt-secret-0123456789abcdef1234567890'  # >= 32 chars
npm run dev -- --config examples/auth/<mode>/config.json --migrate

# API-key example
export API_KEY='example-inventory-key'
npm run dev -- --config examples/auth/api-key/config.json --migrate
```

`--migrate` is only required on the first run (it creates the SQLite schema).
The server listens on `http://localhost:3000`; each config enables Swagger UI
at `http://localhost:3000/api/docs`.

## Reading the OTPs (email-otp / email-mfa)

The `dummy` email provider prints every email to stdout:

```
Email: alice@example.com
HTML Body: <p>Your one-time password is: <strong>482913</strong></p>
Body: Your one-time password is: 482913
This code will expire in 10 minutes.
```

Copy the 6-digit code into the verify calls shown in the per-example READMEs.

## Gotchas worth knowing

- **`isVerifiedField` forces OTP registration.** If a `userModel` defines
  `isVerifiedField`, registration switches to the OTP flow and treats the
  username field as an email address. Never set it for plain
  username/password auth — see the [username-password example](./username-password).
- **`mfaRequired` short-circuits login.** With `mfaRequired: true`, `login`
  returns `{requiresMfa, ulid}` instead of a token; call
  `POST /api/v1/auth/login/verify/otp` to exchange the OTP for a token.
- **OTP examples need `integrations.email`.** Without it the OTP plugin is
  not registered and OTP-sending routes will fail.
- **`password` must be `"secret": true`** so it never leaks into `me`,
  search/index responses or edit bodies.
- **`mfaRequired` requires a configured cache.** Until config validation is
  relaxed, `email-mfa` is the only example in this suite that needs Redis.
- **Auth user-model CRUD is disabled by default.** The auth `users` model is
  not exposed through generic CRUD routes unless explicitly enabled in
  `apis`; the auth routes (`/api/v1/auth/*`) work regardless.
- **Server-side params (SSP) exist but are not usable for user scoping yet.**
  The config key is `serverSideParams` on an api identifier (e.g.
  `model.v1.notes.unknown.getAll`), and identifiers must match the generated
  route identifiers exactly — but SSP injection currently runs *before*
  authentication, so `[userId]` resolves to nothing (tracked in
  [imdeepmind/rocket#87](https://github.com/imdeepmind/rocket/issues/87)).
  That's why these examples pass `userId` explicitly instead of relying on
  SSP.
- **Collection routes have a trailing slash.** List/create paths are
  registered as `/api/v1/<model>/` — the slash is required (Fastify is strict
  about it), so `/api/v1/<model>` 404s. Single-record routes like
  `/api/v1/<model>/id/:id` have no trailing slash.
- **OTP verify payloads** require `{ulid, otp, <usernameField>}`; the
  forgot-password verify call additionally requires `newPassword`.
