---
sidebar_position: 2
---

# Getting Started

This guide walks you through installing ROSS, creating your first configuration file, and running your API server.

## Prerequisites

Before getting started, ensure you have:

- **Node.js** (v20.0.0 or higher)
- **npm** (v10.0.0 or higher)

Verify your installation:

```bash
node -v
npm -v
```

## 1. Installation

You can install ROSS globally to use the `ross` command in your terminal:

```bash
npm install -g @imdeepmind/ross
```

Alternatively, you can install it as a project dependency:

```bash
npm install @imdeepmind/ross
```

Or execute commands directly without installation:

```bash
npx @imdeepmind/ross <command>
```

## 2. Create Your Project

Create a new directory for your project:

```bash
mkdir my-api
cd my-api
```

## 3. Define Your Configuration

ROSS is configuration-driven. Create a file named `ross.json` in your project root:

```json
{
  "application": {
    "name": "Task Manager API"
  },
  "data": {
    "models": {
      "tasks": {
        "timestamps": true,
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true
          },
          "title": {
            "type": "string",
            "nullable": false
          },
          "completed": {
            "type": "boolean",
            "default": false
          }
        }
      }
    }
  }
}
```

> **Tip**: Because the file is named `ross.json`, ROSS automatically discovers it without requiring the `-c` flag.

## 4. Validate Your Configuration

Verify your configuration syntax and schema before running the server:

```bash
ross check
```

Output:

```text
Configuration is valid!
```

## 5. Run Database Migrations

Apply database schema changes to create the SQLite database and `tasks` table:

```bash
ross migrate
```

By default in development mode, ROSS creates a local SQLite database at `./database.db`.

## 6. Start the Development Server

Start the development server with live route logging and interactive documentation:

```bash
ross dev
```

You will see the startup banner displaying your server address and registered routes:

- **API Base URL**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/api/docs`

> **Note**: You can also run migrations and start the dev server in one step with `ross dev -m`.

## 7. Test Your API

### Create a Task

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries", "completed": false}'
```

### List Tasks

```bash
curl http://localhost:3000/api/v1/tasks
```

### Get Task by ID

```bash
curl http://localhost:3000/api/v1/tasks/id/1
```

### Update a Task

```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/id/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

### Delete a Task

```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/id/1
```

## Next Steps

- Explore the [CLI Reference](./cli.md) for all available commands, options, and configuration resolution rules.
- View the interactive Swagger UI at `http://localhost:3000/api/docs` while the server is running.
