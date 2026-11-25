# AGENTS.md — Rocket Monorepo

Monorepo containing ROSS and the Rocket platform.

## Repository Structure

- **`ross/`**: ROSS — open-source, configuration-driven REST API framework (MIT). TypeScript, Fastify 5, Drizzle, Vitest.
- **`ross/docs/`**: ROSS documentation site built with Docusaurus (separate `package.json`, markdown lint, and CI workflow).
- **`rocket/platform/`**: Rocket Platform — source-available backend deployment, hosting, and management web app (PolyForm Shield 1.0.0). Next.js, TypeScript, Tailwind CSS, Storybook.
- **`.github/workflows/`**: CI workflows scoped per package (`ross.yml`, `ross-docs.yml`, `rocket-platform.yml`) plus repo-wide `commit-lint.yml`.

## Commands (`./dev.sh`)

Run project commands from the repository root via `./dev.sh <project> <operation>` (each project also has its own `dev.sh`):

```bash
./dev.sh ross <operation>             # dev, test, coverage, check, e2e, db, csserve, release
./dev.sh ross-docs <operation>        # dev, build, serve, typecheck, lint, check, clear
./dev.sh rocket-platform <operation>  # dev, build, start, lint, lint:fix, check, storybook, build-storybook
```

Run `./dev.sh <project>` with no operation to see its full usage.

## Commit Messages

Enforced in CI by `commitlint` (`commitlint.config.cjs`). Local Git hooks (Husky) are not used.

```
type(scope): #<NUMBER>: message
```

- **Types**: `feat`, `chore`, `ci`, `bug`, `refactor`, `test`
- **Scopes**: `ross`, `ross-docs`, `rocket-platform`, `rocket`, `repo` (`repo` for global/monorepo changes or changes spanning multiple packages; others for project-scoped changes)
- **Max header length**: 120 characters

Example: `feat(ross): #123: add token refresh`

## Branch Naming & Flow

```
<type>/#<issue-number>-<short-description>
```

- `<type>`: one of `feat`, `chore`, `ci`, `bug`, `refactor`, `test`
- `<issue-number>`: GitHub issue number
- `<short-description>`: lowercase, hyphen-separated

Examples: `feat/#86-migrate-commit-msg`, `chore/#221-monorepo-ci-and-tooling`

1. Create a branch from `develop`: `git switch -c feat/#123-short-description`
2. Make changes and verify with the relevant `./dev.sh <project> check`
3. Wait for the developer to review and test the changes — **commit only when explicitly asked to commit**
4. Commit using the commit convention: `git commit -m "feat(ross): #123: short description"`
5. Push the branch (quote `#` in shell): `git push -u origin 'feat/#123-short-description'`
6. Open a PR referencing the issue.
