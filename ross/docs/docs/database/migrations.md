---
sidebar_position: 3
---

# Database Migrations

ROSS features an automated database migration system that manages your schema lifecycle in two steps:

1. **Config-Based Schema Migrations**: Automatically creates and updates database tables from the models declared in your configuration.
2. **Custom SQL Migrations**: Runs user-authored `.sql` scripts to seed data, backfill rows, and apply custom database logic.

## Config-Based Schema Migrations

In ROSS, you don't need to manually write `CREATE TABLE`, `ALTER TABLE`, or index creation scripts for your application models.

Instead, you describe your data models in the `data.models` section of your configuration. Each model specifies its table fields, data types, nullability, primary keys, indexes, and relationships:

```json
{
  "data": {
    "models": {
      "articles": {
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "nullable": false
          },
          "title": {
            "type": "string",
            "nullable": false
          },
          "content": {
            "type": "text",
            "nullable": true
          }
        },
        "indexes": {
          "idx_article_title": {
            "fields": ["title"],
            "unique": false
          }
        }
      }
    }
  }
}
```

### How It Works

When you run migrations (or start the development server with migrations enabled):

1. **Schema Synchronization**: ROSS inspects the models declared in your configuration, checks the current state of your database, and automatically applies the required schema changes:
   - Missing tables are created.
   - Column types, defaults, and nullability constraints are applied.
   - Primary keys and auto-increment sequences are configured.
   - Unique and non-unique indexes are created.
   - Foreign key relationships declared in `relations` are linked.
2. **Safe Table Isolation**: ROSS strictly restricts schema synchronization to only the models defined in your configuration. Any other tables existing in your database (such as tables managed by other applications, internal service tables, or tables created by custom migrations) are left completely untouched.

## Custom SQL Migrations

While config-based migrations manage your model schemas, real-world applications often need custom SQL to:

- Seed initial reference data (roles, permissions, default admin users, country codes).
- Backfill or migrate existing data between schema updates.
- Execute database-specific SQL statements.

Custom migrations allow you to place `.sql` files in a designated folder and have ROSS discover, validate, and execute them reliably across environments.

## Configuration

To enable custom migrations, add the `migrations` object to `infrastructure.database` in your configuration:

```json
{
  "infrastructure": {
    "database": {
      "engine": "postgres",
      "connection": {
        "url": "env:DATABASE_URL"
      },
      "migrations": {
        "directory": "./migrations",
        "dangerouslyAllowDDL": false
      }
    }
  }
}
```

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `directory` | `string` | **Yes** | — | Path to the directory containing your `.sql` migration files (relative to config or absolute). |
| `dangerouslyAllowDDL` | `boolean` | No | `false` | When set to `true`, permits execution of custom scripts containing DDL statements. |

## Directory Structure & Engine Subdirectories

Custom migrations support both shared scripts (run on every database engine) and engine-specific scripts:

```text
migrations/
├── 001_seed_roles.sql            <-- Runs on all engines (PostgreSQL, MySQL, SQLite)
├── 002_seed_permissions.sql      <-- Runs on all engines
├── postgres/
│   └── 003_pg_search_indexes.sql <-- Runs ONLY when connected to PostgreSQL
├── mysql/
│   └── 003_mysql_fulltext.sql    <-- Runs ONLY when connected to MySQL
└── sqlite/
    └── 003_sqlite_fts.sql        <-- Runs ONLY when connected to SQLite
```

### Rules

- **Root Migrations**: Files placed directly in the root of `migrations.directory` execute on any configured database engine.
- **Engine Subdirectories**: Folders named `postgres/`, `mysql/`, or `sqlite/` contain scripts tailored to that specific engine. When running against PostgreSQL, ROSS executes root files and `postgres/` files, while ignoring `mysql/` and `sqlite/`.
- **Supported Folders**: Only `postgres`, `mysql`, and `sqlite` subdirectories are recognized. Unknown folders inside `migrations/` trigger a discovery error.

## File Naming & Numbered Sorting

Migration filenames must match the pattern `<number>_<description>.sql`:

```text
^(\d+)_(.+)\.sql$
```

Examples of valid filenames:

- `001_seed_roles.sql`
- `002_insert_default_admin.sql`
- `10_backfill_slugs.sql`

### Integer-Based Numeric Ordering

ROSS sorts migrations by their **numeric value as an integer**, not alphabetically. This guarantees:

- `9_step.sql` always runs before `10_step.sql`.
- Eliminates alphabetical sorting bugs where `10_*.sql` would run before `2_*.sql`.

### Duplicate Prefix Protection

Every migration script must have a unique numeric prefix. If two files share the same prefix (for example, `001_seed.sql` and `postgres/001_init.sql`), ROSS halts execution with a duplicate prefix error.

## DML Safety Guard (Default Behavior)

By default, custom migrations are restricted to **DML (Data Manipulation Language)** operations only.

### Allowed Statements

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `WITH` (Common Table Expressions)

### Blocked Statements

Any migration script containing DDL keywords (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`) is blocked by default with an error:

```text
Migration "001_create_table.sql" contains non-DML/DDL statements.
Custom migrations only permit data operations by default.
Use --dangerously-allow-ddl to allow this at your own risk.
```

### Why Restrict DDL by Default?

In ROSS, table schemas and column types are intended to be declared in `data.models`. Unchecked DDL in custom scripts can lead to schema drift and unexpected conflicts with your model configurations.

## Opt-In DDL with `--dangerously-allow-ddl`

If your project requires creating custom tables not managed by `data.models`, creating database extensions (such as `pg_trgm` or `uuid-ossp`), or defining triggers and views, you can opt into DDL execution.

### Enabling DDL

1. **Via CLI Flag**:

   ```bash
   # Run migrations with DDL allowed
   ross migrate --dangerously-allow-ddl

   # Run dev server with migrations and DDL allowed
   ross dev -m --dangerously-allow-ddl
   ```

2. **Via Configuration**:

   ```json
   {
     "infrastructure": {
       "database": {
         "migrations": {
           "directory": "./migrations",
           "dangerouslyAllowDDL": true
         }
       }
     }
   }
   ```

### Requirement: DDL Must Be Idempotent

:::warning[DDL Migrations Re-Run on Every Execution]

Pure data migrations execute once and are skipped on subsequent runs. However, **DDL migrations are re-executed on every migration cycle** to maintain schema consistency across deployment rollouts and multi-container environments.

:::

#### Why DDL Migrations Run on Every Execution

On every migration run, ROSS diffs the database schema against your configuration for all ROSS-managed tables declared in `data.models`:

- **Modifications to ROSS-managed tables**: If you add custom indexes, constraints, triggers, or columns to ROSS-managed tables in a custom migration, the config-based sync diffs the database against your model definitions and drops anything not declared in your configuration. Re-executing custom DDL on every migration cycle ensures your custom schema modifications are re-applied and never lost.
- **Custom standalone tables**: If your custom migration creates new tables that are not declared in `data.models`, ROSS leaves them alone and will not drop them. However, because custom DDL scripts run on every migration cycle, all statements must still be idempotent (e.g. `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`) so they do not fail when re-executed.

:::tip[Recommendation: Define Schema via Configuration]

This is a known limitation of ROSS with custom migrations. Because of this behavior, **ROSS strongly recommends creating all tables, columns, indexes, and relations (any DDL basically) directly in your configuration** (`data.models`) unless it is absolutely necessary to do otherwise (such as enabling database extensions, custom triggers, or views).

:::

Because DDL migrations re-run, all DDL statements in your custom migration files **must be idempotent**:

```sql
-- Correct: Idempotent statements that can run multiple times safely
CREATE TABLE IF NOT EXISTS custom_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON custom_audit_log (action);

-- Incorrect: Non-idempotent statements (will fail on subsequent migration runs)
CREATE TABLE custom_audit_log (...);
CREATE INDEX idx_audit_action ON custom_audit_log (action);
```

## History Tracking & Safety Features

### History Table (`_ross_migrations`)

ROSS automatically creates and manages an internal tracking table named `_ross_migrations` in your database:

| Column | Description |
| --- | --- |
| `id` | Migration filename (e.g. `001_seed_roles.sql` or `postgres/002_views.sql`). |
| `checksum` | SHA-256 hash of the migration file content. |
| `contains_ddl` | Boolean indicating whether the script contains DDL statements. |
| `executed_at` | Timestamp of when the migration ran. |

### How Execution Tracking Works

- **Pure Data Migrations (`contains_ddl = false`)**: Once recorded in `_ross_migrations`, pure data migrations are **skipped** on subsequent runs, preventing duplicate row inserts.
- **DDL Migrations (`contains_ddl = true`)**: Re-executed idempotently, and their `executed_at` timestamp is updated in `_ross_migrations`.

### Tamper Protection (Checksum Verification)

Before running migrations, ROSS computes the SHA-256 checksum of every migration file and compares it with the recorded checksum in `_ross_migrations`.

If an already-executed migration file has been modified on disk, ROSS halts immediately:

```text
Migration "001_seed_roles.sql" has been executed previously with a different checksum.
Altering executed migrations is not allowed.
```

:::warning[Never Modify Committed Migration Files]

Once a migration has run against a database, do not alter its contents. If you need to make updates, add a new sequentially numbered file (e.g. `002_update_roles.sql`).

:::

### Atomic Transactions

Each migration file executes inside a dedicated database transaction:

- Semicolon-separated statements in a single file execute atomically.
- If any statement in the file encounters an error, the entire file is rolled back immediately.
- The history entry in `_ross_migrations` is only recorded if all statements succeed.

## Running Migrations

### In Local Development

Use the `-m, --migrate` flag with `ross dev` to automatically sync models and run custom migrations whenever the development server boots:

```bash
# Start dev server and run migrations automatically
ross dev -m

# Start dev server with migrations including custom DDL
ross dev -m --dangerously-allow-ddl
```

### In Production / CI/CD Deployment

In production pipelines or container entrypoints, run `ross migrate` before starting the production server:

```bash
# 1. Run migrations in your deployment step
ross migrate

# Or with opt-in DDL support:
ross migrate --dangerously-allow-ddl

# 2. Start the production server
ross start
```
