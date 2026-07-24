# AGENTS.md — Rocket

Config-driven REST API framework. TypeScript, Fastify 5, PostgreSQL/SQLite, Vitest 4.

## Commands

| Command | Action |
|---|---|
| `./dev.sh dev` | Run dev server with `--config example_config.json` |
| `./dev.sh coverage` | Full test suite with coverage |
| `./dev.sh test` | Run tests |
| `./dev.sh check` | Compile + coverage + lint:write |
| `./dev.sh db` | Start redis and db Docker containers |
| `./dev.sh csserve` | Serve coverage report via HTTP |

Run `./dev.sh check` after every change before committing.

## Testing

- DB is always mocked: `tests/setup.ts` globally mocks `pg` and `better-sqlite3`.
- Route tests use `createTestApp()` from `tests/helpers/test-app.ts` with real Fastify + `fastify.inject()`.
- Plugin tests create throw-away Fastify instances per test.
- Mock state is on shared `pgQueryMock`, `sqliteAllMock` etc. from `tests/helpers/db-mocks.ts`.

## Path aliases

- `@/` → `src/`
- `@tests/` → `tests/`
- Compiled JS needs `tsc-alias` to resolve these (part of `compile`).

## Import order (enforced by Prettier)

Builtins → Third-party → `@/migrator` → `@/plugin` → `@/server` → `@/routes` → `@/interfaces` → `@/types` → `@/validators` → `@/utils` → `@/constants` → `@tests/` → relative `./`

## Commit messages

```
type(scope): ROSS-<NUMBER>: message
```

Types: `feat`, `chore`, `ci`, `bug`, `refactor`, `test`. Max header: 120 chars.

## Architecture essentials

- **Entrypoint:** `src/main.ts` (commander CLI) → `startServer()` in `src/server.ts`.
- **Fastify custom decorators** (augmented in `src/types/fastify.d.ts`): `app.db`, `app.buildResponse()`, `app.appConfig`, `app.cache`, `app.callWebhook`, `app.enforceSSP`.
- **DB abstraction:** Uniform `DatabaseQuery` interface (`{changes, rows}`). PG uses `pg.Pool`, SQLite uses `better-sqlite3` (sync wrapped in Promise). DDL queries are blocked.
- **Config env vars:** Use `env:VARNAME` in JSON config values — resolved by `src/utils/config.ts`.
- **Config validation:** AJV schema in `src/validators/config/schema.ts`. Reference config: `example_config.json`.
- **Plugin registration order** in `startServer()`: db → cache → communicate → rate-limit → response → ssp → webhook → auth. Fastify-plugin (`fp`) wrapper used throughout.
- **ESM only** (`"type": "module"`). No require().
- **`docs/`** is a separate Docusaurus site (own package.json) — not part of the main project.
