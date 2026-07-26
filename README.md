# Rocket OSS

<p align="center">
  <img src="assets/logo.png" alt="Rocket API Framework Logo" width="200" />
</p>

Rocket is a configuration-driven API framework designed to accelerate backend development by automating standard engineering tasks. By defining models in a structured JSON format, Rocket automatically handles database schema generation, RESTful routing, authentication, request validation, and interactive documentation.

## Features

- **Automated API Generation**: Instant creation of CRUD, Search, Index, and Aggregate endpoints from JSON configurations.
- **Database Schema Management**: Automatic handling of table creation, relations, multi-column indexes, and foreign key constraints.
- **Multi-Engine Database Support**: Native support for PostgreSQL and SQLite.
- **Built-in Authentication**: JWT-based authentication with registration, login, password reset, and optional MFA.
- **Caching Layer**: Redis integration for high-performance caching.
- **Rate Limiting**: Configurable request rate limiting with cache-backed storage.
- **Webhooks**: Per-API webhook triggers for request/response events.
- **Custom Endpoints**: SQL-based custom endpoints with parameterized queries.
- **Interactive Documentation**: Integrated Swagger/OpenAPI UI.
- **Robust Validation**: AJV-powered JSON Schema validation for all requests.
- **Advanced Querying**: Filtering, sorting, aggregations, and full-text search.

## Quick Start

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/imdeepmind/rocket.git
cd rocket
npm install
```

### 2. Initialize the Server

Start the server using an existing configuration file:

```bash
npm run dev -- -c example_config.json
```

### 3. API Exploration

Once the server is initialized, refer to the Swagger UI for interactive API documentation:
[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## Configuration

Rocket uses a `config.json` file for system orchestration. Below is a minimal configuration example:

```json
{
  "application": {
    "name": "Rocket OSS",
    "logLevel": "info",
    "rateLimit": {
      "enabled": true,
      "max": 1000,
      "timeWindow": "15m"
    }
  },
  "docs": {
    "openapi": {
      "enabled": true,
      "path": "/api/docs",
      "info": {
        "title": "Rocket API",
        "version": "1.0.0"
      }
    }
  },
  "infrastructure": {
    "database": {
      "engine": "sqlite",
      "connection": { "url": "./database.db" }
    },
    "cache": {
      "engine": "redis",
      "connection": { "url": "redis://localhost:6379" }
    }
  },
  "authentication": {
    "enabled": true,
    "provider": {
      "type": "up-auth",
      "config": {
        "userModel": {
          "model": "users",
          "idField": "id",
          "usernameField": "email",
          "passwordField": "password"
        },
        "jwtSecret": "your-secret-key",
        "mfaRequired": false
      }
    }
  },
  "data": {
    "models": {
      "users": {
        "timestamps": true,
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "apis": ["index", "edit", "delete"]
          },
          "email": {
            "type": "string",
            "unique": true,
            "nullable": false,
            "apis": ["search", "index"],
            "query": ["eq", "sort"]
          },
          "name": {
            "type": "string",
            "nullable": true,
            "query": ["sort"]
          }
        }
      }
    }
  }
}
```

### Field Configuration

Each field supports granular control over API capabilities:

**APIs** - Controls which endpoints expose the field:
- `search`: Full-text search endpoint
- `index`: Get by primary key endpoint
- `edit`: Update endpoint
- `delete`: Delete endpoint

**Query Operations** - Filtering and sorting capabilities:
- `eq`, `ne`: Equality/inequality filters
- `lt`, `lte`, `gt`, `gte`: Comparison filters
- `in`, `not_in`: Array membership filters
- `sort`: Enable sorting by this field

**Aggregations** - Data aggregation functions:
- `count`, `avg`, `sum`, `min`, `max`, `frequency`

### Advanced Features

**Relations**: Define foreign key relationships between models with cascade actions (`belongsTo`).

**Custom Endpoints**: Execute parameterized SQL queries via custom HTTP endpoints.

**Webhooks**: Configure per-API webhooks that trigger on request/response with customizable payloads.

**Server-Side Parameters**: Inject server-controlled parameters into API requests for enhanced security.

See `example_config.json` for a complete configuration reference.

## API Reference

Rocket generates standardized endpoints for every configured model.

### Model Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/:model` | Creates a new record. |
| `GET` | `/:model` | Retrieves records with pagination and filtering support. |
| `GET` | `/:model/:id` | Retrieves a specific record by primary key. |
| `PATCH` | `/:model/:id` | Performs partial updates on a specific record. |
| `DELETE` | `/:model/:id` | Deletes a specific record. |
| `POST` | `/:model/search` | Executes advanced search queries. |
| `POST` | `/:model/aggregate` | Performs data aggregations (count, sum, avg, etc.). |

### Authentication Endpoints (when `up-auth` is enabled)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new user account. |
| `POST` | `/auth/login` | Authenticate and receive JWT token. |
| `POST` | `/auth/change-password` | Change password for authenticated user. |
| `POST` | `/auth/forgot-password` | Initiate password reset flow. |
| `POST` | `/auth/otp/verify/login` | Verify OTP for login (when MFA enabled). |
| `POST` | `/auth/otp/verify/register` | Verify OTP for registration. |
| `POST` | `/auth/otp/verify/forgot-password` | Verify OTP for password reset. |

## Development and Testing

### Testing

Testing is managed via Vitest to ensure performance and reliability.

```bash
# Execute the test suite
npm test

# Generate coverage data
npm run coverage
```

### Code Quality

Linting is enforced to maintain high code standards:

```bash
npm run lint:check
```

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Fastify
- **Architecture**: TypeScript
- **Database**: PostgreSQL and SQLite
- **Cache**: Redis
- **Validation**: AJV
- **Documentation**: Swagger / OpenAPI
- **Testing**: Vitest
