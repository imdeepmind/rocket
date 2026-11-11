# Rocket example: username/password auth

Classic username + password authentication. `register` → `login` → JWT bearer
token → auth-protected `notes` routes. No OTP, no email integration, no MFA —
if that's what you need, look at [`../email-otp`](../email-otp) or
[`../email-mfa`](../email-mfa) instead.

> **Security scope: authentication only.** This example demonstrates
> *authentication*, not *authorization*. Notes are **not** scoped per user —
> see [Security scope](#security-scope-authentication-only) below.

Uses its own SQLite database: `./examples/auth/username-password/database.db`.

## Configuration highlights

- `authentication.provider.type`: `up-auth` with `userModel.usernameField: "username"`.
- **No `isVerifiedField`** — setting it would silently switch registration into
  OTP mode (the username field is then treated as an email address for OTP
  delivery).
- **No `mfaRequired`** — login returns a token directly.
- `password` is `"secret": true`, so it is never returned by any route.
- `notes` has a required `userId` column (FK → `users`), so clients pass their
  user id when creating a note. (Server-side, tamper-proof injection of
  `userId` via `serverSideParams` is on the roadmap — see
  [imdeepmind/rocket#87](https://github.com/imdeepmind/rocket/issues/87).)

## Security scope: authentication only

The `notes` routes require a valid bearer token, but they do **not** check
who owns a note. Any authenticated user can:

- list every note in the database (`GET /api/v1/notes/`),
- read any single note by id (`GET /api/v1/notes/id/:id`),
- filter by another user's id (`GET /api/v1/notes/?userId=<other-id>`),
- create a note attributed to another user (the request body's `userId` is
  trusted as-is),
- aggregate counts across all users
  (`GET /api/v1/notes/aggregation/userId?operations=count`).

This is expected for an example that focuses on authentication. Proper
per-user authorization requires server-side, tamper-proof injection of the
authenticated user's id into `userId` (the `serverSideParams` work tracked in
[imdeepmind/rocket#87](https://github.com/imdeepmind/rocket/issues/87)). Until
that lands, do not treat the notes in this example as private per-user data,
and do not copy this config into production expecting tenant isolation.

## Environment variables

| Variable     | Required | Notes                       |
| ------------ | -------- | --------------------------- |
| `JWT_SECRET` | yes      | Minimum 32 characters long. |

## Run

From the repository root:

```bash
export JWT_SECRET='example-jwt-secret-0123456789abcdef1234567890'
npm run dev -- --config examples/auth/username-password/config.json --migrate
```

The first run needs `--migrate` to create the SQLite schema. Server listens on
`http://localhost:3000`, Swagger UI is at `http://localhost:3000/api/docs`.

## 1. Register

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username": "alice", "password": "correct-horse-battery"}'
```

```json
{
  "code": 201,
  "message": "Successfully registered a new user in the users table",
  "data": { "username": "alice" }
}
```

Note that `password` is absent from the response.

## 2. Login

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "alice", "password": "correct-horse-battery"}'
```

```json
{
  "code": 200,
  "message": "Login successful",
  "data": { "accessToken": "<jwt>" }
}
```

Wrong credentials return `401 Invalid username or password`.

## 3. Who am I?

```bash
TOKEN="<accessToken from step 2>"

curl -s http://localhost:3000/api/v1/auth/user/me \
  -H "Authorization: Bearer $TOKEN"
```

Returns the user record (with `password` stripped).

## 4. Create and list notes

```bash
ME=$(curl -s http://localhost:3000/api/v1/auth/user/me \
  -H "Authorization: Bearer $TOKEN")
USER_ID=$(echo "$ME" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.id))')

curl -s -X POST http://localhost:3000/api/v1/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"title\": \"First note\", \"body\": \"Hello Rocket\", \"status\": \"pending\", \"userId\": $USER_ID}"

curl -s "http://localhost:3000/api/v1/notes/?userId=$USER_ID"
```

`GET /api/v1/notes/` supports filtering — `?userId=<id>` returns a single
user's notes. (This filter is caller-supplied and not enforced against the
token's user — see [Security scope](#security-scope-authentication-only).)
You can also sort with `?orderBy=title&orderDir=asc`.

## 5. Without a token

```bash
curl -s http://localhost:3000/api/v1/notes/
# 401
```
