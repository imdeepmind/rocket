# Rocket example: email + OTP verification + mandatory login MFA

Same as the [email-otp example](../email-otp), plus `"mfaRequired": true`:
every login short-circuits into an OTP challenge instead of returning a
token. Registration behaves identically to the email-otp example (register →
verify OTP), and forgot-password works the same way too.

Uses its own SQLite database: `./examples/auth/email-mfa/database.db`.

## Configuration highlights

- Everything from the [email-otp example](../email-otp), plus
  `"mfaRequired": true` in the provider config, which is what makes `login`
  return an OTP challenge (`{requiresMfa, ulid}`) instead of an access token.
- **`mfaRequired` currently requires a configured cache** (config validation
  enforces this until it is relaxed), so this config also sets
  `infrastructure.cache` with Redis — unlike the other three examples, Redis
  must be reachable at startup. Start it with `./dev.sh db` (or
  `docker compose up -d redis`).
- `integrations.email.provider: "dummy"` — required for the OTP plugin; OTPs
  are printed to the server stdout, never emailed anywhere.

## Environment variables

| Variable     | Required | Notes                       |
| ------------ | -------- | --------------------------- |
| `JWT_SECRET` | yes      | Minimum 32 characters long. |

## Run

From the repository root:

```bash
./dev.sh db   # starts the Redis container required by this example
export JWT_SECRET='example-jwt-secret-0123456789abcdef1234567890'
npm run dev -- --config examples/auth/email-mfa/config.json --migrate
```

OTPs appear in the server output as:

```
Email: bob@example.com
HTML Body: <p>Your one-time password is: <strong>502391</strong></p>
Body: Your one-time password is: 502391
This code will expire in 10 minutes.
```

## 1. Register + verify

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email": "bob@example.com", "password": "correct-horse-battery"}'
# → 201 data: {"requiresMfa": true, "ulid": "01J..."} ; OTP on stdout

curl -s -X POST http://localhost:3000/api/v1/auth/register/verify/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "bob@example.com", "otp": "502391", "ulid": "01J..."}'
```

## 2. Login → OTP challenge, no token yet

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "bob@example.com", "password": "correct-horse-battery"}'
```

```json
{
  "code": 200,
  "message": "Login successful. OTP sent to your email.",
  "data": { "requiresMfa": true, "ulid": "01K..." }
}
```

## 3. Verify login OTP → token

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login/verify/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "bob@example.com", "otp": "673840", "ulid": "01K..."}'
```

```json
{
  "code": 200,
  "message": "OTP verification successful",
  "data": { "accessToken": "<jwt>" }
}
```

## 4. Who am I? + notes

```bash
TOKEN="<accessToken>"

ME=$(curl -s http://localhost:3000/api/v1/auth/user/me \
  -H "Authorization: Bearer $TOKEN")
USER_ID=$(echo "$ME" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.id))')

curl -s -X POST http://localhost:3000/api/v1/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"title\": \"Secret note\", \"status\": \"pending\", \"userId\": $USER_ID}"

curl -s "http://localhost:3000/api/v1/notes/?userId=$USER_ID"
```

(Server-side, tamper-proof injection of `userId` via `serverSideParams` is on
the roadmap — see
[imdeepmind/rocket#87](https://github.com/imdeepmind/rocket/issues/87).)

## 5. Resend the login OTP

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login/resend/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "bob@example.com"}'
```

Forgot-password flows (including `/auth/forgot-password/resend/otp`) work
exactly as in the [email-otp example](../email-otp).
