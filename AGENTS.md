# AGENTS.md — Rocket Monorepo

Repository containing two independent software projects:
- **ROSS (`ross/`)**: Config-driven REST API framework (open-source, MIT). TypeScript, Fastify 5, PostgreSQL/SQLite, Vitest 4.
- **Rocket (`rocket/`)**: Source-available backend deployment, hosting, and management platform (PolyForm Shield 1.0.0).

## Commands

Commands can be run from the repository root via `./dev.sh` (which delegates to `ross/dev.sh`) or directly within `ross/`:

| Command | Action |
| --- | --- |
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

Builtins → Third-party → `@/migrator` → `@/plugin` → `@/server` → `@/lib` → `@/routes` → `@/interfaces` → `@/types` → `@/validators` → `@/utils` → `@/constants` → `@tests/` → relative `./`

## Commit messages

```
type(scope): #<NUMBER>: message
```

Types: `feat`, `chore`, `ci`, `bug`, `refactor`, `test`. Max header: 120 chars.

Example: `feat(auth): #123: add token refresh`

## Branch naming

```
<type>/#<issue-number>-<short-description>
```

- `<type>` is one of the allowed commit types: `feat`, `chore`, `ci`, `bug`, `refactor`, `test`.
- `<issue-number>` is the GitHub issue being worked on.
- `<short-description>` is lowercase, hyphen-separated.

Examples: `feat/#86-migrate-commit-msg`, `bug/#92-fix-auth-refresh`, `refactor/#74-split-where-builder`

Flow:

1. Create a branch from the default branch: `git switch -c feat/#86-migrate-commit-msg`.
2. Wait for the developer to review and test your changes.
3. Commit using the commit convention: `git commit -m "chore(ci): #86: migrate commit convention from JIRA to GitHub Issues"`.
4. Push the branch (quote `#` in shell commands): `git push -u origin 'feat/#86-migrate-commit-msg'`.
5. Open a PR that references the issue.

## Architecture essentials

- **Entrypoint:** `src/main.ts` (commander CLI) → `startServer()` in `src/server.ts`.
- **Fastify custom decorators** (augmented in `src/types/fastify.d.ts`): `app.db`, `app.buildResponse()`, `app.appConfig`, `app.cache`, `app.callWebhook`, `app.enforceSSP`.
- **DB abstraction:** Uniform `DatabaseQuery` interface (`{changes, rows}`). PG uses `pg.Pool`, SQLite uses `better-sqlite3` (sync wrapped in Promise). DDL queries are blocked.
- **Config env vars:** Use `env:VARNAME` in JSON config values — resolved by `src/lib/config/env.ts`.
- **Config validation:** AJV schema in `src/validators/config/schema.ts`. Reference config: `example_config.json`.
- **Plugin registration order** in `startServer()`: db → cache → communicate → rate-limit → response → ssp → webhook → auth. Fastify-plugin (`fp`) wrapper used throughout.
- **Shared library code lives in `src/lib/`**, grouped by framework layer: `config/` (env resolution, API identifiers, `config.apis` accessors), `schema/` (JSON Schema builders for Swagger), `sql/` (WHERE-clause filters, placeholder parsing), `server/` (prevalidation, welcome screen). Tests mirror this under `tests/lib/`.
- **ESM only** (`"type": "module"`). No require().
- **`docs/`** is a separate Docusaurus site (own package.json) — not part of the main project.
