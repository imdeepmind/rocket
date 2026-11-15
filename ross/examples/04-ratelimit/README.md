# Rate Limit Example

This example demonstrates how to configure and verify IP-based request rate limiting in ROSS using `application.rateLimit`.

Rate limiting protects your API against brute-force attacks, scraping, and denial-of-service by limiting how many requests an individual client IP can make within a specified time window.

## Configuration

[`ratelimit_config.json`](./ratelimit_config.json):

```json
{
  "application": {
    "name": "Rate Limit Example API",
    "rateLimit": {
      "enabled": true,
      "max": 5,
      "timeWindow": "1m",
      "rateLimitHealthAPI": false
    },
    "healthCheck": {
      "enabled": true,
      "path": "/api/health"
    }
  }
}
```

### Key Options

- `enabled`: Set to `true` to activate rate limiting.
- `max`: Maximum number of requests allowed per client IP within the configured time window (in this example, `5`).
- `timeWindow`: Duration window for the rate limiter. Supported time units:
  - `s` — seconds (e.g. `"30s"`)
  - `m` — minutes (e.g. `"1m"`, `"15m"`)
  - `h` — hours (e.g. `"1h"`)
  - `d` — days (e.g. `"1d"`)
- `rateLimitHealthAPI`: When `false` (default), the health check endpoint (`/api/health`) is exempt from rate limits so continuous uptime/orchestrator probes are never throttled. Set to `true` if you want the health check to count towards the client's rate limit.

### Rate Limit Headers

Every response includes RFC-standard rate limit tracking headers:

| Header | Description |
|---|---|
| `x-ratelimit-limit` | Maximum allowed requests in the current window |
| `x-ratelimit-remaining` | Number of requests remaining in the current window |
| `x-ratelimit-reset` | Seconds until the current rate limit window resets |

## Running the Example

```bash
ross dev -c ratelimit_config.json
```

## Verification with curl

### 1. Observe Decreasing Remaining Limit
Send a request to an API route and check the rate limit headers:

```bash
curl -i http://localhost:3000/api/v1/messages/
```

Notice the headers in the response:
```http
HTTP/1.1 200 OK
x-ratelimit-limit: 5
x-ratelimit-remaining: 4
x-ratelimit-reset: 59
```

### 2. Exceed the Rate Limit (HTTP 429 Too Many Requests)
Execute requests in a loop until the quota of 5 is exceeded:

```bash
for i in {1..6}; do
  echo "--- Request $i ---"
  curl -s -i http://localhost:3000/api/v1/messages/ | grep -E "HTTP|x-ratelimit|message"
done
```

On the 6th request, ROSS rejects the call with `429 Too Many Requests`:

```http
HTTP/1.1 429 Too Many Requests
content-type: application/json; charset=utf-8
x-ratelimit-limit: 5
x-ratelimit-remaining: 0
x-ratelimit-reset: 55

{"statusCode":429,"error":"Too Many Requests","message":"Rate limit exceeded, retry in 1 minute"}
```

### 3. Verify Health Check Bypass
Even while regular API endpoints return `429 Too Many Requests`, the health check route remains accessible because `rateLimitHealthAPI` is set to `false`:

```bash
curl -i http://localhost:3000/api/health
```

Expected response:
```http
HTTP/1.1 200 OK
...
{"status":"ok",...}
```

