# Rocket example: API key auth

Machine-to-machine style authentication: every protected route expects the
API key in an `x-api-key` header. There is no user model, no JWT, and the
auth routes (`/api/v1/auth/*`) are not registered at all — the example
instead protects an `inventory` CRUD model. See the other examples in this
directory for username/password, OTP and MFA flows.

Uses its own SQLite database: `./examples/auth/api-key/database.db`.

## Configuration highlights

- `authentication.provider.type: "api-key"` with `config.key: "env:API_KEY"`.
- No `userModel` / `jwtSecret` / `mfaRequired`, and no email integration.
- `model.v1.inventory.unknown.getAll` is configured with
  `"authorization": false` — a per-route override that makes listing the
  inventory public, even though auth is globally enabled. Every other route
  on the model requires the API key.
- **Collection routes live under a trailing slash** (Fastify is strict about
  it): use `/api/v1/inventory/` for list and create — `/api/v1/inventory`
  without the slash is a 404. Single-record routes
  (`/api/v1/inventory/id/:id`) have no trailing slash. Swagger at
  `http://localhost:3000/api/docs` always shows the exact paths.

## Environment variables

| Variable  | Required | Notes                                              |
| --------- | -------- | -------------------------------------------------- |
| `API_KEY` | yes      | The shared secret clients must send in `x-api-key`. |

## Run

From the repository root:

```bash
export API_KEY='example-inventory-key'
npm run dev -- --config examples/auth/api-key/config.json --migrate
```

## 1. Public listing (no key needed)

```bash
curl -s http://localhost:3000/api/v1/inventory/
```

Returns the inventory collection. This works without a header because of the
`authorization: false` override on the `getAll` route.

## 2. Create (key required)

```bash
curl -s -X POST http://localhost:3000/api/v1/inventory/ \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name": "Blue mug", "quantity": 42, "location": "A1"}'
```

## 3. Missing / wrong key → 401

```bash
curl -s -X POST http://localhost:3000/api/v1/inventory/ \
  -H 'Content-Type: application/json' \
  -d '{"name": "Red mug", "quantity": 1, "location": "B2"}'
# 401

curl -s -X POST http://localhost:3000/api/v1/inventory/ \
  -H 'x-api-key: not-the-right-key' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Red mug", "quantity": 1, "location": "B2"}'
# 401
```

## 4. Edit and delete (key required)

```bash
ID="<id returned in step 2>"

curl -s -X PATCH "http://localhost:3000/api/v1/inventory/id/$ID" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"quantity": 40}'

curl -s -X DELETE "http://localhost:3000/api/v1/inventory/id/$ID" \
  -H "x-api-key: $API_KEY"
```
