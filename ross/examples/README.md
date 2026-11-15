# ROSS Examples

A collection of runnable, self-contained examples demonstrating ROSS configuration and features. Each example contains its own `config.json` and a `README.md` with step-by-step `curl` walkthroughs.

## Available Examples

| # | Directory | Feature | Description | Key Config |
|---|---|---|---|---|
| 01 | [`01-barebone/`](./01-barebone/) | **Minimal CRUD** | Zero-setup CRUD API with SQLite and automatic schema creation | `data.models` |
| 02 | [`02-cors/`](./02-cors/) | **CORS** | Cross-Origin Resource Sharing with origin whitelisting, methods, headers, and preflights | `application.cors` |
| 03 | [`03-healthcheck/`](./03-healthcheck/) | **Health Checks** | Built-in readiness and liveness probe verifying HTTP, database, and cache | `application.healthCheck` |
| 04 | [`04-ratelimit/`](./04-ratelimit/) | **Rate Limiting** | IP-based request throttling with configurable time windows and health check bypass | `application.rateLimit` |

## Running Any Example

Each example can be started using the `ross` CLI:

```bash
cd examples/<directory>
ross dev -c <config>.json
```

All examples run out-of-the-box using local SQLite (`./database.db`) and in-memory caching — no external Redis, PostgreSQL, or network dependencies required.

