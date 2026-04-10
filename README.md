# Rocket

<p align="center">
  <img src="assets/logo.png" alt="Rocket API Framework Logo" width="200" />
</p>

Rocket is a configuration-driven API framework designed to accelerate backend development by automating standard engineering tasks. By defining models in a structured JSON format, Rocket automatically handles database schema generation, RESTful routing, request validation, and interactive documentation.

## Features

- **Automated API Generation**: Instant creation of CRUD, Search, and Aggregate endpoints from JSON configurations.
- **Database Schema Management**: Automatic handling of table creation, multi-column indexes, and foreign key constraints.
- **Multi-Engine Database Support**: Native support for both PostgreSQL and SQLite.
- **Interactive Documentation**: Integrated Swagger/OpenAPI UI available at the specified documented path.
- **Robust Validation**: Driven by AJV (JSON Schema) for strict and customizable request validation.
- **Advanced Querying**: Native support for filtering, sorting, and complex search operations.

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

Rocket utilizes a `config.json` file for system orchestration. Below is an overview of the primary configuration blocks:

```json
{
  "swagger": {
    "enabled": true,
    "basePath": "/api/docs",
    "info": { "title": "Rocket API", "version": "1.0.0" }
  },
  "database": {
    "engine": "sqlite",
    "connection": { "urlOrPath": "./database.db" }
  },
  "models": [
    {
      "name": "users",
      "fields": [
        { "name": "id", "type": "integer", "primaryKey": true },
        { "name": "email", "type": "string", "unique": true, "supportedOperations": ["searchable", "equal", "sortable"] }
      ]
    }
  ]
}
```

### Field Operations

Specific operations can be enabled per field to control API exposure:

- `searchable`: Enables full-text search capabilities on the specific field.
- `equal`, `greaterThan`, `oneOf`: Provides granular filtering options.
- `sortable`: Permits sorting based on the field values.

## API Reference

Rocket generates standardized endpoints for every configured model.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/:model` | Creates a new record. |
| `GET` | `/:model` | Retrieves records with pagination and filtering support. |
| `PATCH` | `/:model/:id` | Performs partial updates on a specific record. |
| `DELETE` | `/:model/:id` | Deletes a specific record. |
| `POST` | `/:model/search` | Executes advanced search queries. |
| `POST` | `/:model/aggregate` | Performs data aggregations (e.g., count). |

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
- **Validation**: AJV
- **Documentation**: Swagger / OpenAPI
- **Testing**: Vitest
