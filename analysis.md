# 🔍 Rocket Codebase Audit

Full analysis of every source file. Findings grouped by severity.

---

## 🔴 Security Issues

### SEC-1 · SQL Injection via `orderBy` query parameter

**Files:** [get-all.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/get-all.ts#L118), [index-route.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/index-route.ts#L156), [search.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/search.ts#L136)

The `orderBy` value from the query string is interpolated directly into SQL without validation:

```typescript
query += ` ORDER BY "${queryParams.orderBy}" ${queryParams.orderDir === 'desc' ? 'DESC' : 'ASC'}`;
```

An attacker can send `?orderBy=id"; DROP TABLE users; --` and it will be injected into the SQL statement. The Swagger enum constraint only applies to documentation, not actual runtime filtering.

> [!CAUTION]
> **Critical.** This is a textbook SQL injection. The `orderBy` value must be validated against the list of allowed sortable field names before being inserted into the query string.

---

### SEC-2 · SQL Injection via filter column names

**Files:** [get-all.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/get-all.ts#L86-L110), [index-route.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/index-route.ts#L119-L143), [search.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/search.ts#L103-L128), [edit.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/edit.ts#L135-L158)

Column names extracted from query parameter keys (e.g. `key.replace('_eq', '')`) are injected directly into SQL:

```typescript
whereClauses.push(`"${key.replace('_eq', '')}" = $${paramIndex++}`);
```

An attacker could send `?"; DROP TABLE users; --_eq=1`. The column name is never validated against the model's actual field list.

> [!CAUTION]
> **Critical.** Column names must be validated against the model's known fields before being used in SQL construction.

---

### SEC-3 · SQL Injection via `post.ts` column names

**File:** [post.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/post.ts#L41-L43)

Column names from the request body are interpolated into SQL:

```typescript
const columns = keys.map((key) => `"${key}"`).join(', ');
```

While `stripAdditionalPostFields` limits keys to known model fields, if `model.validation` is used (custom schema), a crafted body key could bypass this if the model has a permissive `additionalProperties: true` validation schema.

> [!WARNING]
> Medium risk. The `stripAdditionalPostFields` mitigates this, but only if field names in the model schema are exhaustive. Worth adding a whitelist check.

---

### SEC-4 · Database credentials in config file (committed example)

**File:** [example_config.json](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/example_config.json#L24)

```json
"urlOrPath": "postgres://devuser:devpassword@db:5432/rocketdb"
```

The hardcoded credentials in the example config file  are a risk if someone uses this as a starting point in production. Additionally, the docker-compose file exposes the same credentials.

> [!IMPORTANT]
> Consider using environment variable substitution (e.g. `${DATABASE_URL}`) instead of hardcoded connection strings.

---

### SEC-5 · No authentication or authorization

The framework generates fully open CRUD endpoints with no middleware for auth. Anyone can create, read, update, and delete any record.

> [!WARNING]
> This is likely intentional for an early prototype, but should be documented as a known limitation and planned feature.

---

### SEC-6 · No rate limiting

No rate limiter is configured on the Fastify instance. All auto-generated endpoints are vulnerable to brute-force and DDoS attacks.

---

### SEC-7 · Default value SQL injection in table creation

**File:** [table-creator.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/database/table-creator.ts#L89)

```typescript
const defValue = typeof field.default === 'string' ? `'${field.default}'` : field.default;
typeStr += ` DEFAULT ${defValue}`;
```

String default values are not escaped. A malicious config like `"default": "'; DROP TABLE users; --"` would inject SQL during table creation.

> [!WARNING]
> The config is trusted (loaded from a file), but if configs ever come from user input, this is exploitable.

---

### SEC-8 · `ON DELETE` / `ON UPDATE` values not validated against safe whitelist

**File:** [fk-creator.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/database/fk-creator.ts#L55-L56)

```typescript
const onDeleteClause = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
```

While the AJV schema validates these against an enum, the `fk-creator.ts` itself doesn't validate. If the validator is bypassed, this is injectable.

---

## 🟠 Bugs

### BUG-1 · Missing `ajv-formats` in `package.json` dependencies

**File:** [package.json](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/package.json)

`ajv-formats` is imported in [config.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/validators/config.ts#L2) but is NOT listed in `package.json` under `dependencies` or `devDependencies`. It works only because it exists as a transitive dependency of `@fastify/swagger`. If the Swagger dependency is removed or updated, the app will crash.

> [!IMPORTANT]
> Must be explicitly listed as a dependency.

---

### BUG-2 · Missing `fastify-plugin` in `package.json` dependencies

**File:** [package.json](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/package.json)

`fastify-plugin` is imported in both [database.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/plugin/database.ts#L1) and [response.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/plugin/response.ts#L1) but is **not** listed in `package.json`. Same transitive dependency risk as BUG-1.

> [!IMPORTANT]
> Must be explicitly listed as a dependency.

---

### BUG-3 · Duplicate `CLIOptions` interface

**File:** [types/index.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/types/index.ts#L4-L14)

```typescript
export interface CLIOptions {   // lines 4-8
  config: string;
  port: number;
  mode: Mode;
}

export interface CLIOptions {   // lines 10-14  — DUPLICATE
  config: string;
  port: number;
  mode: Mode;
}
```

TypeScript merges duplicate interfaces, so this doesn't crash, but it's clearly a copy-paste error.

---

### BUG-4 · `post.ts` extracts table name from URL instead of using `model.name`

**File:** [post.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/post.ts#L35)

```typescript
const tableName = request.url.split('/')[1];
```

This is fragile. If the server is mounted behind a prefix or a proxy adds path segments, this will extract the wrong table name. Other routes (delete, edit, etc.) correctly use `model.name` directly.

> [!WARNING]
> This is inconsistent with the rest of the codebase and will break under prefix routing.

---

### BUG-5 · Primary key fields included in POST body

**File:** [schema-helpers.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/schema-helpers.ts#L136-L156)

`buildPostBodyValidationSchema` includes ALL fields (including the `SERIAL`/`AUTOINCREMENT` primary key) in the POST body schema. Users should not provide the primary key during INSERT operations — the database auto-generates it.

For the `users` model, the auto-generated `id` column is `SERIAL PRIMARY KEY` but the POST endpoint will accept and attempt to insert an `id` value in the body, potentially causing constraint violations.

---

### BUG-6 · Primary key required in auto-generated POST validation

Related to BUG-5: The `required` list in `buildPostBodyValidationSchema` includes the primary key (since `nullable` is `false` and `default` is `undefined`). This means the auto-generated schema considers `id` as a required body field for POST, even though the DB auto-generates it.

---

### BUG-7 · No `RETURNING` clause for POST/INSERT queries

**File:** [post.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/post.ts#L43-L45)

The INSERT query doesn't use `RETURNING *`, so the response sends back the original body (without auto-generated fields like `id`, `created_at`, etc.). The client never learns the assigned primary key.

---

### BUG-8 · `PATCH`/`PUT` doesn't return the updated record

**File:** [edit.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/edit.ts#L162-L175)

Same as BUG-7 — the UPDATE query doesn't use `RETURNING *`, so the response sends back the original body, not the actual updated state of the record.

---

### BUG-9 · `DELETE` returns 204 regardless of whether any row was actually deleted

**File:** [delete.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/delete.ts#L51-L53)

The DELETE route always returns 204, even if the `WHERE` clause matched zero rows. Should return 404 if `res.changes === 0`.

---

### BUG-10 · `database.db` committed to the repository

**File:** [database.db](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/database.db)

Although `database.db` is in `.gitignore`, the file exists in the repo. It may have been committed before the gitignore rule was added.

---

## 🟡 Optimization Opportunities

### OPT-1 · Massive code duplication in filter/WHERE clause building

**Files:** `get-all.ts`, `index-route.ts`, `search.ts`, `edit.ts`

The exact same filter-building loop (handling `_eq`, `_lt`, `_lte`, `_gt`, `_gte`, `_in` suffixes) is copy-pasted across **4 files** (~30 lines each, ~120 duplicated lines total). This should be extracted into a shared utility function like `buildWhereClauses(queryParams, paramIndex)`.

---

### OPT-2 · No maximum limit on pagination `limit` parameter

**Files:** [get-all.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/get-all.ts#L123), [index-route.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/index-route.ts#L161), [search.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/search.ts#L141)

```typescript
const limit = Math.max(Number(queryParams.limit) || 20, 1);
```

There is no upper bound. A user can send `?limit=1000000` and retrieve the entire table in a single query, causing memory and performance issues.

---

### OPT-3 · No PostgreSQL connection pool size configuration

**File:** [database.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/plugin/database.ts#L35-L37)

```typescript
const pool = new Pool({
  connectionString: opts.connection.urlOrPath,
});
```

The `pg.Pool` uses defaults (10 connections). There's no way to configure pool size, idle timeout, or connection timeouts through the config.

---

### OPT-4 · Aggregate route makes multiple DB queries when one suffices

**File:** [aggregate.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/aggregate.ts#L100-L122)

When both standard aggregations and `frequency` are requested, two separate queries are made. The frequency query could potentially be combined, or at minimum these could be parallelized with `Promise.all`.

---

### OPT-5 · `SELECT *` everywhere

**Files:** All read routes (`get-all.ts`, `index-route.ts`, `search.ts`)

Every query uses `SELECT *`. If tables have many columns or large TEXT/BLOB fields, this unnecessarily loads all data. Consider allowing field selection through query params.

---

### OPT-6 · No result count / total count in paginated responses

Paginated endpoints return `{ page, limit }` but no `totalCount`. Clients cannot know how many pages exist without a separate query. A `COUNT(*)` query (or `COUNT(*) OVER()`) should be added.

---

## 🔵 Code Quality & Architecture Issues

### CQ-1 · No tests whatsoever

**File:** [package.json](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/package.json#L10)

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

There are zero unit tests, integration tests, or end-to-end tests. The `test` directory referenced in `tsconfig.json` likely doesn't exist.

---

### CQ-2 · No graceful shutdown handling

**File:** [server.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/server.ts#L125-L131)

There is no `SIGTERM`/`SIGINT` handler. When the process is terminated, the DB connection pool won't be cleanly drained. Fastify's `onClose` hook is registered but never triggered because `app.close()` is never called on signal.

---

### CQ-3 · `docker-compose.yml` uses deprecated `version` key

**File:** [docker-compose.yml](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/docker-compose.yml#L1)

`version: '3.8'` is deprecated in modern Docker Compose. Also, the server container runs `npm install` on every start, which is slow.

---

### CQ-4 · Two conflicting prettier configs

**Files:** `.prettierrc` and `.prettierrc.js` both exist. This is confusing; only one should be used.

---

### CQ-5 · `helloWorldResponseSchema` is dead code

**File:** [schema-helpers.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/routes/schema-helpers.ts#L119-L126)

This exported constant is never imported or used anywhere.

---

### CQ-6 · `HTTPMethod` type is unused

**File:** [types/index.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/types/index.ts#L2)

```typescript
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
```

This type is defined but never imported or used. It also doesn't include `PATCH`, `HEAD`, or `OPTIONS`.

---

### CQ-7 · `model.validation` bypasses model field schema

When a model has a `validation` property, `buildPostBodyValidationSchema` returns it verbatim. This means the schema could differ from the actual table structure, causing runtime mismatches (e.g., validation passes but the SQL INSERT fails because of wrong column names or types).

---

### CQ-8 · No config schema for `supportedOperations` enum values

**File:** [config.ts (validator)](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/validators/config.ts#L114-L118)

The AJV schema for `supportedOperations` only validates `type: 'array'` with `items: { type: 'string' }`. It doesn't restrict to the known enum values. The `validateFieldConstraints` function catches invalid operations later, but they could be caught earlier during schema validation.

---

### CQ-9 · `modelSchema` requires `indexes` and `foreignKeys` but they're optional in types

**File:** [config.ts (validator)](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/validators/config.ts#L193)

```typescript
required: ['name', 'fields', 'indexes', 'foreignKeys'],
```

But in [schema/config.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/schema/config.ts#L85-L86):

```typescript
indexes?: ModelIndexConfig[];
foreignKeys?: ModelForeignKeyConfig[];
```

The AJV `default: []` on indexes/foreignKeys compensates for this, but there's a mismatch between TypeScript types (optional) and the AJV schema (required). If someone constructs an `AppConfig` object in code without running it through AJV, the discrepancy could cause issues.

---

### CQ-10 · `showWelcomeScreen` is called before `app.listen` succeeds

**File:** [server.ts](file:///Users/imdeepmind/Desktop/WorkspaceV2/rocket/src/server.ts#L126-L127)

```typescript
showWelcomeScreen(config, port, routes);
await app.listen({ port, host: '0.0.0.0' });
```

The welcome screen (with "API Host: <http://0.0.0.0:3000>") is printed before the server actually binds to the port. If `app.listen` fails (e.g. port already in use), the user sees a misleading welcome screen followed by a crash.

---

## Summary Table

| Category | Count | Critical |
|----------|-------|----------|
| 🔴 Security | 8 | SEC-1, SEC-2 are critical SQL injection |
| 🟠 Bugs | 10 | BUG-1, BUG-2 can crash at runtime |
| 🟡 Optimization | 6 | OPT-2 can cause OOM |
| 🔵 Code Quality | 10 | CQ-1 (no tests) is highest risk |

### Top 5 Priority Fixes

1. **SEC-1 + SEC-2**: Validate `orderBy` and filter column names against model fields
2. **BUG-1 + BUG-2**: Add `ajv-formats` and `fastify-plugin` to `package.json`
3. **BUG-5 + BUG-6**: Exclude primary key from POST body schema & required
4. **OPT-1**: Extract duplicated filter builder into shared utility
5. **CQ-1**: Add at least basic test coverage
