# CORS Example

This example demonstrates how to configure Cross-Origin Resource Sharing (CORS) in ROSS using the `application.cors` configuration block.

CORS allows web applications running in browsers on different domains or ports (such as a React/Vue/Svelte frontend on `http://localhost:5173`) to interact with the API securely.

## Configuration

[`cors_config.json`](./cors_config.json):

```json
{
  "application": {
    "name": "CORS Example API",
    "cors": {
      "enabled": true,
      "origins": [
        "http://localhost:5173",
        "https://app.example.com"
      ],
      "methods": [
        "GET",
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
        "OPTIONS"
      ],
      "allowedHeaders": [
        "Content-Type",
        "Authorization",
        "x-api-key"
      ],
      "exposedHeaders": [
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
        "x-ratelimit-reset"
      ],
      "credentials": false,
      "maxAge": 86400,
      "routes": [
        "/api/**"
      ]
    }
  }
}
```

### Key Options

- `origins`: Allowlist of permitted origin domains. Exact matches or `*` (wildcard allowed only when `credentials: false`). Environment variable placeholders (e.g. `env:FRONTEND_ORIGIN`) are also supported.
- `methods`: HTTP methods permitted for cross-origin requests.
- `allowedHeaders`: Request headers that clients may send during cross-origin calls.
- `exposedHeaders`: Custom response headers that JavaScript running in the browser is allowed to read.
- `credentials`: Whether requests can include user credentials (cookies, authorization headers, or TLS client certificates).
- `maxAge`: Number of seconds browsers may cache preflight `OPTIONS` responses (`86400` = 24 hours).
- `routes`: Optional glob pattern(s) to restrict CORS to specific paths (e.g. `["/api/**"]`).

## Running the Example

```bash
ross dev -c cors_config.json
```

## Verification with curl

### 1. Request with an Allowed Origin
When sending a request with an allowlisted `Origin` header, the response includes `Access-Control-Allow-Origin` matching the request:

```bash
curl -i http://localhost:3000/api/v1/notes/ \
  -H "Origin: http://localhost:5173"
```

Expected headers in the response:
```http
access-control-allow-origin: http://localhost:5173
```

### 2. Preflight `OPTIONS` Request
Browsers send an `OPTIONS` preflight request before non-simple requests (e.g., `POST` with JSON body). ROSS responds with `204 No Content` and the allowed methods and headers:

```bash
curl -i -X OPTIONS http://localhost:3000/api/v1/notes/ \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

Expected response:
```http
HTTP/1.1 204 No Content
access-control-allow-origin: http://localhost:5173
access-control-allow-methods: GET, POST, PATCH, PUT, DELETE, OPTIONS
access-control-allow-headers: Content-Type, Authorization
access-control-max-age: 86400
```

### 3. Request with a Disallowed Origin
When an unknown origin attempts to access the API:

```bash
curl -i http://localhost:3000/api/v1/notes/ \
  -H "Origin: https://untrusted-site.com"
```

Expected behavior: The request is processed, but **no** `access-control-allow-origin` header is returned, prompting the browser to block the client from reading the response.

