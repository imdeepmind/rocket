---
sidebar_position: 3
---

# CLI Reference

ROSS provides a subcommand-driven command line interface (`ross`) for development, production deployment, database migrations, configuration inspection, and route auditing.

## Command Overview

| Command | Alias | Description |
| --- | --- | --- |
| `ross dev` | | Start development server with welcome banner and route table |
| `ross start` | `ross serve` | Start production server with graceful shutdown |
| `ross build` | | Build custom function endpoints into standalone bundles |
| `ross migrate` | `ross db:push` | Run database migrations and exit |
| `ross config validate` | `ross check` | Validate configuration syntax, schema, and relations |
| `ross config show` | | Resolve, redact secrets, and print full configuration |
| `ross routes` | | List all registered API routes and methods |

---

## Configuration Path Resolution

All commands accept an optional `-c, --config <path>` flag. When omitted, ROSS automatically locates your configuration file using the following resolution hierarchy:

### 1. Explicit CLI Flag (`-c, --config`)

If `-c` or `--config` is passed, ROSS uses that exact file path. If the file does not exist, an error is thrown immediately.

```bash
ross dev -c ./configs/custom.json
```

### 2. Environment Variable (`ROSS_CONFIG`)

If no CLI flag is provided, ROSS checks for the `ROSS_CONFIG` environment variable.

```bash
export ROSS_CONFIG="./configs/staging.json"
ross dev
```

### 3. Auto-Discovery (Current Working Directory)

If neither the flag nor the environment variable is set, ROSS searches the current working directory in the following priority order:

1. `ross.json` *(recommended default)*
2. `config.json`
3. `ross.config.json`
4. `example_config.json`

If none of these candidate files exist, ROSS exits with an error:

```text
No configuration file found. Provide one via -c, --config <path> or create a ross.json in the current directory.
```

---

## Commands

### `ross dev`

Starts the development server. In development mode:

- Compiles custom TypeScript function endpoints declared in `customEndpoints` into standalone bundles under `.ross/functions/` before starting the server.
- Displays a startup welcome banner with server URL and Swagger documentation link.
- Prints a list of all registered models and custom API endpoints.
- Enables Swagger UI (by default at `/api/docs`).

```bash
ross dev [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file (uses auto-discovery if omitted).
- `-p, --port <number>`: Port to run the server on (default: `3000` or config setting).
- `-H, --host <host>`: Host interface to bind to (default: `0.0.0.0`).
- `-m, --migrate`: Automatically run database migrations before booting the server.
- `-v, --verbose`: Enable verbose logging output.

#### Examples

```bash
# Start dev server with auto-discovered ross.json
ross dev

# Run migrations first and bind to port 8080
ross dev -m -p 8080

# Use a specific config file
ross dev -c ./my-config.json
```

---

### `ross start`

**Alias:** `ross serve`

Starts the server in production mode.

- Suppresses developer banners for clean container log output.
- Listens for `SIGINT` and `SIGTERM` signals for graceful shutdown (drains connections and closes database pools).

```bash
ross start [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file.
- `-p, --port <number>`: Port to run the server on (default: `3000`).
- `-H, --host <host>`: Host interface to bind to (default: `0.0.0.0`).
- `-v, --verbose`: Enable verbose logging output.

#### Examples

```bash
# Start production server
ross start

# Alias with custom port
ross serve -p 8080
```

---

### `ross build`

Builds all custom TypeScript function endpoints declared in your configuration file into standalone, single-file bundles under `.ross/functions/`.

- Bundles source files with `esbuild` targeting Node.js 24 with ESM output and source maps.
- Deduplicates compilation: each unique TypeScript source file is compiled exactly once, even if referenced by multiple endpoints with different exported handlers.
- Validates that every named handler function is properly exported as a callable function from the bundle.
- Exits with status `0` on success (or when no function endpoints are defined).
- Exits with status `1` on compilation or export validation failure with error details.

```bash
ross build [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file (uses auto-discovery if omitted).
- `-v, --verbose`: Enable verbose logging output (shows resolved config and working directory).

#### Examples

```bash
# Build function endpoints using auto-discovered config
ross build

# Build using a specific configuration file with verbose logging
ross build -c ./configs/production.json -v
```

---

### `ross migrate`

**Alias:** `ross db:push`

Connects to the configured database engine (PostgreSQL, SQLite, MySQL, or MariaDB), applies table schemas, indexes, and foreign keys defined in `data.models`, and exits.

- Exits with status `0` on success.
- Exits with status `1` on failure with error details.

```bash
ross migrate [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file.
- `-v, --verbose`: Enable verbose logging output.

#### Examples

```bash
# Run migrations using auto-discovered config
ross migrate

# Using alias
ross db:push -c ./production.json
```

---

### `ross config validate`

**Top-Level Alias:** `ross check`
**Subcommand Alias:** `ross config check`

Validates your configuration file without starting the server or connecting to external databases.

- Checks JSON syntax and structure against the AJV schema.
- Verifies model relationships, foreign keys, and indexes.
- Validates authentication, RBAC permissions, and custom API configurations.
- Exits with status `0` if valid, or status `1` with formatted validation errors if invalid.

```bash
ross config validate [options]
# Or using top-level alias:
ross check [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file.
- `-m, --mode <mode>`: Mode to validate against: `dev` or `prod` (default: `dev`).

#### Examples

```bash
# Validate local configuration
ross check

# Validate against production requirements
ross check -m prod
```

---

### `ross config show`

Resolves the configuration by evaluating environment variables (`env:VAR_NAME`) and applying framework defaults. Redacts sensitive credentials (passwords, JWT secrets, webhook tokens) by default.

```bash
ross config show [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file.
- `-m, --mode <mode>`: Mode: `dev` or `prod` (default: `dev`).
- `--raw`: Print raw configuration with unredacted secrets.

#### Examples

```bash
# View resolved configuration with secrets redacted
ross config show

# View configuration for production mode
ross config show -m prod

# View raw unredacted configuration
ross config show --raw
```

---

### `ross routes`

Prints a formatted list of all HTTP endpoints registered by the framework, including:

- Auto-generated CRUD routes for each model (`GET`, `POST`, `PATCH`, `DELETE`).
- Search and aggregate endpoints.
- Authentication endpoints (if enabled).
- Custom API routes defined in configuration.

```bash
ross routes [options]
```

#### Options

- `-c, --config <path>`: Path to configuration file.
- `-m, --mode <mode>`: Mode: `dev` or `prod` (default: `dev`).

#### Examples

```bash
# List all registered routes
ross routes

# List routes for a specific config in prod mode
ross routes -c ./api-config.json -m prod
```
