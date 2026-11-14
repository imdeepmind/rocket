---
sidebar_position: 3.5
---

# Programmatic Usage

ROSS can be embedded directly into an existing Node.js or TypeScript application instead of being started through the CLI. In this mode you import the framework as a library, keep full control of the Fastify instance, and decide when (or whether) to call `app.listen()`.

This is useful for:

- Mounting ROSS inside an existing Fastify server or test harness.
- Authoring configuration in TypeScript with full type checking.
- Running migrations from a deployment script.
- Testing APIs with `app.inject()` without opening a port.

## Installation

```bash
npm install @imdeepmind/ross
```

The package is ESM-only and exposes a single entrypoint.

## Quick start

```typescript
import {createServer} from '@imdeepmind/ross';

import {config} from './config.js';

const {app, routes} = await createServer(config);

// ROSS never calls listen() for you.
await app.listen({port: 3000, host: '0.0.0.0'});
```

`createServer()` runs the full configuration pipeline — environment variable resolution, defaults, normalization, and schema validation — and returns:

| Property | Description |
| --- | --- |
| `app` | The configured Fastify instance. |
| `routes` | Every registered route as `{method, url, apiIdentifier?}`. |

It does **not** start the HTTP listener and does **not** run migrations.

## Configuration

A programmatic configuration is the same object you would otherwise put in `ross.json`:

```typescript
import type {AppConfigInput} from '@imdeepmind/ross';

export const config: AppConfigInput = {
  application: {
    name: 'Task API',
    logLevel: 'info',
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {url: './database.db'},
    },
    cache: {
      engine: 'memory',
    },
  },
  data: {
    models: {
      tasks: {
        timestamps: true,
        fields: {
          id: {type: 'integer', primaryKey: true, autoIncrement: true},
          title: {type: 'string', nullable: false},
          completed: {type: 'boolean', default: false},
        },
      },
    },
  },
};
```

Environment references work exactly the same way:

```typescript
infrastructure: {
  database: {
    engine: 'postgres',
    connection: {url: 'env:DATABASE_URL'},
  },
},
```

## Resolving configuration separately

Use `defineConfig()` when you want the resolved and validated configuration without creating a server — for example, to run migrations, inspect effective defaults, or reuse the configuration elsewhere.

```typescript
import {defineConfig} from '@imdeepmind/ross';

import {config} from './config.js';

const resolved = defineConfig(config);

console.log(resolved.application.rateLimit);
console.log(resolved.infrastructure.database);
```

`defineConfig()` accepts two optional settings:

```typescript
const resolved = defineConfig(config, {
  // "dev" or "prod". Defaults to "prod" when NODE_ENV=production, otherwise "dev".
  mode: 'prod',
  // Base directory for relative paths such as custom function files and migration folders.
  configDir: '/srv/task-api',
});
```

Calling `createServer()` on an already resolved configuration is safe: the pipeline is idempotent, so defaults and resolved paths are preserved.

## Running migrations

`migrateDatabase()` is exported separately. It expects a resolved configuration, so run it through `defineConfig()` first:

```typescript
import {createServer, defineConfig, migrateDatabase} from '@imdeepmind/ross';

import {config} from './config.js';

const resolved = defineConfig(config, {mode: 'prod'});

await migrateDatabase(resolved);

const {app} = await createServer(config);

await app.listen({port: 3000});
```

This keeps migrations an explicit deployment step rather than a side effect of starting the server.

## Controlling Fastify

Because `createServer()` returns the Fastify instance, you can extend it before listening:

```typescript
import {createServer} from '@imdeepmind/ross';

import {config} from './config.js';

const {app} = await createServer(config);

app.addHook('onRequest', async request => {
  request.log.info({url: request.url}, 'incoming request');
});

app.get('/custom', async () => ({ok: true}));

await app.listen({port: 3000});
```

Shutdown is also the caller's responsibility:

```typescript
process.on('SIGTERM', async () => {
  await app.close();
});
```

### Testing without a network listener

`createServer()` is safe to use in tests. Use Fastify's `inject()` to exercise routes without binding a port:

```typescript
import {createServer} from '@imdeepmind/ross';

import {config} from './config.js';

const {app} = await createServer(config);

const response = await app.inject({
  method: 'GET',
  url: '/api/tasks',
});

console.log(response.statusCode, response.json());

await app.close();
```

## Typed Fastify extensions

Importing from `@imdeepmind/ross` also ships the type augmentation used by the framework, so decorators added by ROSS are typed on `FastifyInstance` and `FastifyRequest`:

```typescript
import type {FastifyInstance, FastifyRequest} from '@imdeepmind/ross';

declare const app: FastifyInstance;
declare const request: FastifyRequest;

app.db.query('SELECT 1');
app.cache.get('task-count');
app.appConfig.application.name;
app.buildResponse(200, 'OK', {id: 1});

request.authenticate();
```

## Exported API

| Export | Kind | Description |
| --- | --- | --- |
| `createServer(config, options?)` | function | Resolves, validates, and builds the Fastify application. Never calls `listen()`. |
| `defineConfig(config, options?)` | function | Runs the configuration pipeline and returns a `ResolvedAppConfig`. |
| `migrateDatabase(config)` | function | Applies database schema and custom migrations from a resolved configuration. |

Useful exported types include `AppConfigInput`, `ResolvedAppConfig`, `CreateServerOptions`, `StartServerResult`, `RouteInfo`, `FastifyInstance`, and `FastifyRequest`.

## Comparison with the CLI

| | CLI | Programmatic |
| --- | --- | --- |
| Configuration | JSON file | JavaScript/TypeScript object |
| Server start | `ross start` / `ross dev` | You call `app.listen()` |
| Migrations | `ross migrate` | You call `migrateDatabase()` |
| Shutdown | CLI handles signals | You call `app.close()` |
| Custom hooks/plugins | Not supported | Full Fastify control |

See the [CLI Reference](./cli.md) for the command-line workflow and [Getting Started](./get-started.md) for the JSON configuration format.
