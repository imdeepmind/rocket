---
sidebar_position: 1
---

# Database Configuration

The `infrastructure.database` section of your configuration defines your application's primary database connection. ROSS connects directly to your database, pools connections, and exposes model data through automatically generated REST APIs.

ROSS supports three relational database engines:
- **PostgreSQL** (`"postgres"`)
- **MySQL / MariaDB** (`"mysql"`)
- **SQLite** (`"sqlite"`)

## Default Behavior

The framework applies different defaults depending on your execution mode:

| Mode | `infrastructure.database` | Behavior & Defaults |
| --- | --- | --- |
| **Development (`dev`)** | Optional | Defaults to a local SQLite database at `./database.db` with a 10-second timeout. |
| **Production (`prod`)** | **Required** | Startup immediately halts with `ConfigError: infrastructure.database is required in prod mode`. |

### Development Mode Default

In `dev` mode, the database configuration defaults to SQLite at `./database.db`:

```json
{
  "infrastructure": {
    "database": {
      "engine": "sqlite",
      "connection": {
        "url": "./database.db"
      },
      "timeout": 10000
    }
  }
}
```

If `./database.db` does not exist, ROSS creates it automatically, allowing you to run `ross dev` with zero setup.

## Example Configurations

### PostgreSQL

```json
{
  "infrastructure": {
    "database": {
      "engine": "postgres",
      "connection": {
        "url": "env:DATABASE_URL"
      },
      "timeout": 30000
    }
  }
}
```

### MySQL / MariaDB

```json
{
  "infrastructure": {
    "database": {
      "engine": "mysql",
      "connection": {
        "url": "env:MYSQL_URL"
      },
      "timeout": 30000
    }
  }
}
```

### SQLite

```json
{
  "infrastructure": {
    "database": {
      "engine": "sqlite",
      "connection": {
        "url": "./data/app.db"
      }
    }
  }
}
```

## Fields Reference

### `engine`

- **Type**: `string`
- **Required**: **Yes** (when `database` block is provided)
- **Allowed values**: `"postgres"`, `"mysql"`, `"sqlite"`

Specifies the relational database engine.

### `connection`

- **Type**: `object`
- **Required**: **Yes** (when `database` block is provided)

Contains connection parameters.

#### Properties

#### `connection.url`
- **Type**: `string`
- **Required**: **Yes**

The connection URL or file path for the database.

:::tip[Use Environment Variables for Secrets]

Never commit passwords or database URLs to version control. Use the `env:` prefix to resolve credentials from your environment at runtime (e.g. `"url": "env:DATABASE_URL"`). When viewing your configuration with `ross config show`, ROSS automatically redacts sensitive credentials.

:::

### `timeout`

- **Type**: `integer`
- **Required**: No
- **Default**: `10000` (10 seconds)
- **Minimum**: `1`

The maximum query execution timeout in milliseconds. If a query exceeds this duration, it is cancelled.

## Engine Guides

### PostgreSQL

- **Engine Identifier**: `"postgres"`
- **Connection URL Format**:
  ```text
  postgresql://[user[:password]@][host][:port][/dbname][?param1=value1]
  ```
- **Example**:
  ```json
  {
    "engine": "postgres",
    "connection": {
      "url": "postgresql://postgres:secret@localhost:5432/my_database"
    }
  }
  ```
- **Features**:
  - Native connection pooling with automatic pool sizing.
  - Full support for PostgreSQL data types, including UUIDs, native JSON/JSONB, timestamps with time zone, and enums.
  - Safe transactional rollbacks on multi-statement queries.
  - Automatic connection draining and graceful pool shutdown on server stop (`SIGINT` / `SIGTERM`).

### MySQL / MariaDB

ROSS supports MySQL (v8.0+) and MariaDB.

- **Engine Identifier**: `"mysql"`
- **Connection URL Format**:
  ```text
  mysql://[user[:password]@][host][:port][/dbname][?param1=value1]
  ```
- **Example**:
  ```json
  {
    "engine": "mysql",
    "connection": {
      "url": "mysql://root:secret@localhost:3306/my_database"
    }
  }
  ```
- **Features**:
  - Connection pooling with automatic reconnection handling.
  - Support for auto-incrementing integer primary keys and full-text indexes.
  - Multi-statement execution support enabled during migration runs.

### SQLite

SQLite requires zero installation or external database processes.

- **Engine Identifier**: `"sqlite"`
- **Connection URL Format**: Relative file path (e.g. `./data/app.db`) or absolute file path (e.g. `/var/data/app.db`).
- **Validation**: The path must end with `.db` or `.sqlite`. In-memory databases (`":memory:"`) are not supported; a persistent file path is required.
- **Example**:
  ```json
  {
    "engine": "sqlite",
    "connection": {
      "url": "./data/app.db"
    }
  }
  ```
- **Features**:
  - **Automatic Directory Creation**: If the folder containing your SQLite database (such as `./data/`) does not exist, ROSS creates it automatically when the server starts.
  - High-performance, synchronous file operations wrapped in async Promise APIs for Fastify.

## Accessing the Database in Custom Functions

When writing custom TypeScript or JavaScript function endpoints (`customEndpoints` with `handler.type: "function"`), you can query the database directly using Fastify's `app.db` decorator.

Every custom function handler receives the `request` and `app` instances:

```typescript
import { FastifyInstance, FastifyRequest } from 'fastify';

interface UserRecord {
  id: number;
  email: string;
  role: string;
}

export async function getActiveUsers(request: FastifyRequest, app: FastifyInstance) {
  // Execute a parameterized query across PostgreSQL, MySQL, or SQLite
  const result = await app.db.query<UserRecord>(
    'SELECT id, email, role FROM users WHERE active = $1;',
    [true]
  );

  return {
    total: result.rows.length,
    users: result.rows,
  };
}
```

### The `app.db.query` Interface

`app.db.query(sql, params)` provides a uniform abstraction across all supported database engines:

- **Returns**: A Promise resolving to `DatabaseQuery<T>`:
  - `rows: T[]` — Array of matching record objects.
  - `changes: number` — Number of affected rows (for `INSERT`, `UPDATE`, `DELETE`).
- **Unified Parameter Placeholders (`$1`, `$2`, ...)**: ROSS standardizes on positional placeholders (`$1`, `$2`, `$3`, ...) across all database engines. You author your queries using `$1, $2, ...` regardless of which database you are connected to:
  - **PostgreSQL**: Passed directly to PostgreSQL's native driver as `$1, $2, ...`.
  - **MySQL & SQLite**: ROSS automatically translates `$1, $2, ...` placeholders into `?` placeholders at runtime before executing against the driver.
  - **Automatic Value Normalization**: For SQLite and MySQL, ROSS also automatically converts parameter types to driver-compatible values (e.g. booleans `true`/`false` are converted to `1`/`0`, `Date` objects are converted to ISO 8601 strings, and `undefined` becomes `null`).
  - This ensures your custom function SQL queries remain fully portable across PostgreSQL, MySQL, and SQLite without manual dialect branching.
- **Connection Management**: Connections are automatically acquired from the pool and released back when the query finishes.

### Transactions in Custom Functions

For multi-step database operations that require all-or-nothing execution, use transactions:

```typescript
export async function transferBalance(request: FastifyRequest, app: FastifyInstance) {
  const { fromId, toId, amount } = request.body as any;

  const tx = await app.db.beginTransaction();
  try {
    await tx.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2;', [amount, fromId]);
    await tx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2;', [amount, toId]);
    await tx.commit();
    return { success: true };
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.release();
  }
}
```

## Custom SQL Queries (Zero-Code Endpoints)

If you need a complex SQL query (joins, aggregations, reporting) but don't want to author separate TypeScript files, you can define a custom SQL endpoint directly in your configuration using `handler.type: "sql"`:

```json
{
  "customEndpoints": {
    "getProjectSummary": {
      "method": "GET",
      "path": "/projects/:id/summary",
      "description": "Aggregate task statistics for a project",
      "handler": {
        "type": "sql",
        "sql": "SELECT p.name, COUNT(t.id) as task_count FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE p.id = [[path.id:integer]] GROUP BY p.id, p.name;"
      }
    }
  }
}
```

### Key Features
- **Dynamic Parameter Tokens**: Inject inputs safely using `[[source.param:type]]` tokens (e.g. `[[path.id:integer]]`, `[[query.status:string]]`, `[[body.title:string]]`).
- **Automatic SQL Injection Protection**: ROSS compiles placeholder tokens into native parameterized queries (`$1` in PostgreSQL, `?` in SQLite/MySQL). Values are never concatenated into the SQL string directly.
- **DML Safety**: Custom SQL endpoints only permit data retrieval and mutation queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WITH`). DDL statements (`CREATE`, `ALTER`, `DROP`) are blocked by default.

For full syntax options, validation rules, and supported sources, see the [Custom SQL Endpoints](../custom-endpoints/sql.md) guide.
