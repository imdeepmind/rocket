---
sidebar_position: 5
---

# OpenAPI & Swagger

ROSS automatically inspects your data models, custom endpoints, authentication schemes, and route policies to generate an OpenAPI 3.0 compliant specification and serve an interactive Swagger UI.

This provides instant, live API documentation with zero manual maintenance, allowing you and your team to explore routes, inspect request/response schemas, and execute test requests directly in your browser.

## Overview & Architecture

When your ROSS server initializes:

1. **Schema Introspection**: ROSS translates data model field definitions, validations, and database constraints into standard JSON Schemas.
2. **OpenAPI Assembly**: Fastify registers `@fastify/swagger`, compiling route parameters, query filters, request bodies, and authentication headers into an OpenAPI 3.0 document.
3. **Swagger UI Mount**: Fastify registers `@fastify/swagger-ui`, rendering the interactive documentation dashboard at the configured path (defaults to `/docs`).
4. **Security Scheme Discovery**: If authentication is enabled, ROSS automatically configures the appropriate OpenAPI security scheme (`bearerAuth` for JWT or `apiKeyAuth` for API keys) and activates the Swagger UI **Authorize** button.

## Configuration (`docs.openapi`)

OpenAPI metadata and Swagger UI behavior are customized in the `docs.openapi` block of your application configuration:

```json
{
  "docs": {
    "openapi": {
      "enabled": true,
      "path": "/docs",
      "info": {
        "title": "E-Commerce API",
        "description": "RESTful services for orders, inventory, and customer accounts",
        "version": "1.0.0",
        "termsOfService": "https://example.com/terms",
        "contact": {
          "name": "Acme Support Team",
          "url": "https://example.com/support",
          "email": "support@example.com"
        },
        "license": {
          "name": "Apache 2.0",
          "url": "https://www.apache.org/licenses/LICENSE-2.0.html"
        }
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `boolean` | No | `true` in dev, `false` in prod | Controls whether Swagger UI and the OpenAPI endpoints are registered. |
| `path` | `string` | No | `"/docs"` | The URL path where Swagger UI is mounted at root level. |
| `info` | `object` | No | `{}` | OpenAPI metadata describing the API. |
| `info.title` | `string` | No | `application.name` | The title displayed in Swagger UI and OpenAPI exports. |
| `info.description` | `string` | No | `undefined` | A detailed description or summary of your API. |
| `info.version` | `string` | No | `"1.0.0"` | The semantic version of your API specification. |
| `info.termsOfService` | `string` | No | `undefined` | URL pointing to your API terms of service. Must be a valid URI. |
| `info.contact` | `object` | No | `undefined` | Contact information for the API maintainers. |
| `info.license` | `object` | No | `undefined` | License information for the API. |

:::warning[Environment Defaults for `enabled`]

By default, ROSS enables documentation in development mode (`mode: "dev"`) and deactivates it in production mode (`mode: "prod"`) to prevent exposing internal API specifications publicly:

- **Development (`NODE_ENV !== "production"`)**: `enabled: true`
- **Production (`NODE_ENV === "production"`)**: `enabled: false`

If you want live documentation in production (e.g. for a public developer platform), explicitly set `"enabled": true`.

:::

### Contact & License Specifications

When declaring `contact` or `license`, ensure fields satisfy validation requirements:

- **`contact`**:
  - `name`: Must be at least 5 characters.
  - `url`: Must be a valid URI (e.g. `https://example.com/contact`).
  - `email`: Must be a valid email address.
- **`license`**:
  - `name`: License identifier (e.g. `"MIT"` or `"Apache 2.0"`). Required if `license` is provided.
  - `url`: URL pointing to the full license text. Must be a valid URI.

## Interactive Swagger UI

When enabled, Swagger UI is served directly at your configured path:

```text
http://localhost:3000/docs
```

:::note

Swagger UI is mounted at the root URL (e.g. `http://localhost:3000/docs`), outside of the `/api` prefix used for auto-generated endpoints.

:::

### Features

- **Route Grouping**: Endpoints are organized into distinct collapsible tags (e.g. `Posts`, `Users`, `Custom Endpoints`) derived automatically or customized via `apis.<key>.tags`.
- **Live Requests ("Try it out")**: Test endpoints directly from the browser, with query filters, URL parameters, and JSON bodies validated in real time.
- **Deep Schema Explorer**: Expand request body schemas and HTTP response definitions to review data types, nullability, enums, and nested relations.

## Authentication & Security Schemes

ROSS automatically synchronizes your OpenAPI security configuration with your active authentication setup in `authentication`:

### 1. JWT Bearer Authentication

When using username/password (`up-auth`) or Single Sign-On (`sso`), ROSS registers an HTTP Bearer security scheme in OpenAPI:

```json
{
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}
```

In Swagger UI, click the green **Authorize** button at the top right, enter your JWT access token, and all subsequent "Try it out" requests will include the `Authorization: Bearer <token>` header automatically.

### 2. Static API Key Authentication

When using static API key authentication (`authentication.providers: [{ "type": "api-key" }]`), ROSS registers an API Key header scheme:

```json
{
  "components": {
    "securitySchemes": {
      "apiKeyAuth": {
        "type": "apiKey",
        "name": "x-api-key",
        "in": "header"
      }
    }
  }
}
```

The **Authorize** modal in Swagger UI prompts you for the `x-api-key` header value.

## Schema Integration & Privacy Guardrails

ROSS automatically reflects your database modeling and route policies in the generated OpenAPI schema while safeguarding sensitive data:

### 1. Secret Field Exclusion

Fields configured with `secret: true` in `data.models` (such as passwords, credit card tokens, or internal flags) are **automatically omitted** from:

- Response schemas (success status codes 200/201).
- Request query parameters.
- Search filter bodies.

If an endpoint explicitly enables `bypassSecret: true` in its `apis` policy (e.g. an administrative variant), the secret fields are restored to that endpoint's schema.

### 2. Server-Side Parameters (SSP) Invisibility

When a query or body parameter is configured under `serverSideParams` in `apis`, ROSS strips that parameter entirely from Swagger UI and OpenAPI documentation. Because the server enforces the value internally, consumers do not see it in the API contract.

### 3. Query Whitelisting

When a model route configures `supportedQueries` under `apis`, only the whitelisted query operators (e.g. `eq`, `gte`, `sort`) are rendered as query parameters in Swagger UI. All disabled query parameters are excluded.

### 4. Custom Tags & Operations

You can override the default tag grouping in Swagger UI for any route using the `tags` property in `apis`:

```json
{
  "apis": {
    "model.v1.orders.unknown.insert": {
      "tags": ["Checkout & Billing"]
    }
  }
}
```

## Production Recommendations

1. **Keep Disabled in Production by Default**: Leave `enabled: false` (the default in production) unless you are publishing a public developer API.
2. **Custom URL Mount**: If you publish documentation publicly, consider changing `path` from the default `/docs` to a branded endpoint such as `/developer/reference` or `/api-reference`.
3. **Accurate Metadata**: Provide `termsOfService`, `contact`, and `license` to ensure third-party API clients and SDK generators produce valid documentation.
