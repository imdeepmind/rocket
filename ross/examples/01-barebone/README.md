# Barebone API Example

A minimal, zero-setup REST API using SQLite and in-memory caching. Demonstrates how ROSS generates full CRUD and search endpoints from a single model definition.

## Configuration

[`barebone_config.json`](./barebone_config.json):

- **Database**: SQLite (defaults to `./database.db` when infrastructure is omitted in dev mode).
- **Cache**: In-memory `NodeCache` fallback.
- **Model**: `notes` with `id`, `title`, `body`, and `status`.

## Running the Example

```bash
ross dev -c barebone_config.json
```

## Generated Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/notes/` | Create a new note |
| `GET` | `/api/v1/notes/` | List notes with pagination and sorting |
| `GET` | `/api/v1/notes/id/:id` | Get note by primary key ID |
| `GET` | `/api/v1/notes/search/title?title_search=...` | Search notes by title |
| `PATCH` | `/api/v1/notes/title/:title` | Update notes by title |
| `PUT` | `/api/v1/notes/title/:title` | Replace notes by title |
| `PATCH` | `/api/v1/notes/status/:status` | Update notes by status |
| `DELETE` | `/api/v1/notes/status/:status` | Delete notes by status |
| `GET` | `/api/health` | Built-in health check |
| `GET` | `/docs` | OpenAPI / Swagger UI (dev mode) |

## Quick Verification with curl

### 1. Create a note
```bash
curl -i -X POST http://localhost:3000/api/v1/notes/ \
  -H "Content-Type: application/json" \
  -d '{"title": "First Note", "body": "Hello ROSS", "status": "draft"}'
```

### 2. List all notes
```bash
curl -i http://localhost:3000/api/v1/notes/
```

### 3. Check health status
```bash
curl -i http://localhost:3000/api/health
```

