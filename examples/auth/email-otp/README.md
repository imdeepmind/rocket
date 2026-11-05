# Rocket example: email + OTP verification

Email + password authentication where registration must be confirmed by an
OTP, and forgot-password also flows through an OTP. After verification, login
behaves like plain username/password (no MFA challenge) — see
[`../email-mfa`](../email-mfa) for the MFA variant.

Uses its own SQLite database: `./examples/auth/email-otp/database.db`.

## Configuration highlights

- `userModel.usernameField: "email"` and `userModel.isVerifiedField: "isVerified"`.
  The presence of `isVerifiedField` is what switches registration, login and
  forgot-password into OTP mode.
- `integrations.email.provider: "dummy"` — required, otherwise the OTP plugin
  is not registered. The `dummy` provider only logs emails to the server
  stdout; no real SMTP or network access happens.
- `password` is `"secret": true`, so it is never returned by any route.
- `notes` has a required `userId` column (FK → `users`); clients pass their
  user id when creating a note. (Server-side, tamper-proof injection of
  `userId` via `serverSideParams` is on the roadmap — see
  [imdeepmind/rocket#87](https://github.com/imdeepmind/rocket/issues/87).)

## Environment variables

| Variable     | Required | Notes                       |
| ------------ | -------- | --------------------------- |
| `JWT_SECRET` | yes      | Minimum 32 characters long. |

## Run

From the repository root:

```bash
export JWT_SECRET='example-jwt-secret-0123456789abcdef1234567890'
npm run dev -- --config examples/auth/email-otp/config.json --migrate
```

Watch the server output — OTPs are printed there by the `dummy` email
provider, looking like:

```
Email: alice@example.com
HTML Body: <p>Your one-time password is: <strong>482913</strong></p>
Body: Your one-time password is: 482913
This code will expire in 10 minutes.
```

## 1. Register → returns a pending verification

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "correct-horse-battery"}'
```

```json
{
  "code": 201,
  "message": "Registration successful. OTP sent to your email.",
  "data": { "requiresMfa": true, "ulid": "01J..." }
}
```

The account is created but unverified; an OTP is sent (printed to stdout).

## 2. Verify registration OTP

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register/verify/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "otp": "482913", "ulid": "01J..."}'
```

The payload is `{ulid, otp, <usernameField>}` — here `email`.

## 3. Login

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "password": "correct-horse-battery"}'
```

```json
{
  "code": 200,
  "message": "Login successful",
  "data": { "accessToken": "<jwt>" }
}
```

## 4. Who am I?

```bash
TOKEN="<accessToken>"

curl -s http://localhost:3000/api/v1/auth/user/me \
  -H "Authorization: Bearer $TOKEN"
```

## 5. Notes

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

(Server-side, tamper-proof injection of `userId` via `serverSideParams` is on
the roadmap — see
[imdeepmind/rocket#87](https://github.com/imdeepmind/rocket/issues/87).)

## 6. Forgot password (OTP based)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com"}'
# → data: {"requiresMfa": true, "ulid": "01J..."} ; OTP printed to stdout

curl -s -X POST http://localhost:3000/api/v1/auth/forgot-password/verify/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com", "otp": "114782", "ulid": "01J...", "newPassword": "even-better-horse"}'
```

After this, login with the new password.

## 7. Resend endpoints

If an OTP was not received, resend instead of re-starting the flow:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register/resend/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com"}'

curl -s -X POST http://localhost:3000/api/v1/auth/forgot-password/resend/otp \
  -H 'Content-Type: application/json' \
  -d '{"email": "alice@example.com"}'
```

(`/auth/login/resend/otp` also exists, but is only useful when login itself
requires an OTP — see the [email-mfa example](../email-mfa).)
