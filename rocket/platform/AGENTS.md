# AGENTS.md — Rocket Platform

Next.js frontend application for the Rocket platform (App Router, React 19, TypeScript, Tailwind CSS, Better Auth, Drizzle ORM).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

Run commands inside `rocket/platform/` (or via npm scripts):

| Command                   | Action                                                         |
| ------------------------- | -------------------------------------------------------------- |
| `npm run dev`             | Start Next.js development server                               |
| `npm run build`           | Build production Next.js bundle                                |
| `npm run start`           | Start production server                                        |
| `npm run lint`            | Run ESLint                                                     |
| `npm run prettier`        | Check code formatting                                          |
| `npm run prettier:write`  | Format code with Prettier                                      |
| `npm run auth:generate`   | Generate Better Auth schema (`lib/db/schema/auth.ts`)          |
| `npm run db:generate`     | Generate new SQL migrations in `drizzle/` from schemas         |
| `npm run db:migrate`      | Apply pending migrations from `drizzle/` to PostgreSQL         |
| `npm run db:push`         | Push schema changes directly to the database (prototyping/dev) |
| `npm run storybook`       | Start Storybook development server on port 6006                |
| `npm run build-storybook` | Build static Storybook site                                    |

Always ensure `npm run lint` and `npm run prettier:write` pass cleanly.

## Database & Migrations

- **ORM & Dialect:** Drizzle ORM with PostgreSQL (`pg` pool, `drizzle-orm`, `drizzle-kit`).
- **Configuration:** `drizzle.config.ts` reads `DATABASE_URL` and points to schema `lib/db/schema/index.ts` with output in `drizzle/`.
- **Database Client:** Initialized in `lib/db/index.ts` using connection pool in `lib/db/pool.ts`.
- **Schema Directory:** All schemas live in `lib/db/schema/` and are re-exported by `lib/db/schema/index.ts`.
- **Better Auth Schema:** Managed via Better Auth CLI. Run `npm run auth:generate` whenever `lib/auth/auth.ts` changes.
- **Migration Workflow:**
  1. Update or create schemas under `lib/db/schema/` (or update auth config and run `npm run auth:generate`).
  2. Generate a new migration with `npm run db:generate`. This creates versioned SQL files under `drizzle/` (e.g. `drizzle/0000_...sql`).
  3. Apply migrations to the database with `npm run db:migrate`.
  4. Always commit generated migration files in `drizzle/` along with the schema changes.

## Codebase Architecture & Rules

### 1. Component Hierarchy: `bits`, `items`, and `container` (`components/`)

All UI components reside in `components/` and are organized into three distinct tiers:

- **`bits` (`components/bits/`)**: Atomic, low-level primitive building blocks focused on single responsibilities (e.g., `Box`, `Flex`, `Grid`, `Button`, `IconButton`, `TextBox`, `Card`, `Typography`, `Tag`, `IconBadge`, `Avatar`, `ProgressBar`, `Section`, `Select`). Bits encapsulate styling variants and accessibility, and serve as drop-in replacements for raw HTML elements.
- **`items` (`components/items/`)**: Reusable composite UI components constructed by composing multiple `bits` (e.g., `ActionMenu`, `Breadcrumb`, `FileDropzone`, `MetricCard`, `OAuthButtonGroup`, `OptionCardGroup`, `Stepper`, `Table`, `Tabs`, `TerminalViewer`).
- **`container` (`components/container/`)**: Page-targeted and section-level containers assembled by composing `bits` and `items` for dedicated views or feature areas (e.g., `components/container/landing/`, `components/container/auth/`, `components/container/dashboard/`, `components/container/navigation/`, `components/container/create-project/`, `components/container/billing/`, `components/container/settings/`, `components/container/usage/`).

### 2. Avoid Direct HTML Entities & Tags

- Direct HTML tags and entities (`<button>`, `<input>`, `<p>`, `<span>`, `<h1>`–`<h6>`, raw tables, etc.) are highly discouraged and must be avoided almost all the time.
- Always use the dedicated primitive `bits` (e.g., `Text`, `Button`, `TextBox`, etc.) or `items` instead of raw HTML elements.

### 3. Component Styling & `classNameOverride`

- Every component should accept a `classNameOverride` prop (instead of freeform `className` where possible).
- `classNameOverride` is an escape hatch and should only be used when strictly necessary.
- All component styling and variants (size, color variant, layout states) must be encapsulated within the component itself and controlled via component props.

### 4. Design Tokens & CSS Variables (`globals.css`)

- Design tokens for colors, padding, margin, border-radius, standard widths, and spacing must be defined as CSS variables in `app/globals.css`.
- Always use these CSS variables and constants instead of adding arbitrary or hardcoded values across components and CSS modules.

### 5. Direct Component Imports (No Barrel Imports)

- Avoid importing from barrel/index re-exports of parent folders, such as `import { Button } from "@/components/bits"`.
- Always import directly from the specific component module:

  ```typescript
  // Direct import for primitive bits:
  import Button from '@/components/bits/Button';
  import Button, {ButtonProps} from '@/components/bits/Button';
  // Direct import for page containers:
  import Hero from '@/components/container/landing/Hero';
  // Direct import for page containers:
  import Hero from '@/components/container/landing/Hero';
  // Direct import for composite items:
  import Stepper from '@/components/items/Stepper';
  // Direct import for composite items:
  import Stepper from '@/components/items/Stepper';
  ```

### 6. Relative vs. Absolute Imports

- Relative imports are **only allowed within the exact same folder** (e.g., `./styles.module.css` or `./SubComponent.tsx`).
- Parent directory traversal using `../` is **strictly forbidden** (e.g., `../Button/Button.tsx` is not allowed).
- Any import from outside the current directory must use the `@/*` absolute path alias (e.g., `@/components/bits/Button`).

### 7. Icons Location (`icons/`)

- All icon components must reside in the `icons/` directory.

### 8. Module Exports

- Avoid named exports and prefer `default export` for components and modules.
- Named exports should only be used when a single file genuinely needs to export multiple items (such as type definitions accompanying a component or multi-utility modules).

### 9. Folder Organization & Routing (`app/` vs Outside)

- In Next.js App Router, folders within `app/` define routes when they contain `page.tsx` or `route.ts`.
- `app/` should strictly contain pages, layouts, and route handlers.
- Other shared code—such as `components/`, `icons/`, `lib/`, etc.—should be kept outside `app/` to prevent confusion between routing endpoints and internal codebase modules.

## Import Order (enforced by Prettier)

1. Node built-in modules
2. Third-party packages
3. `@/components/*` (all component tiers: `bits`, `items`, and `container`)
4. `@/icons/*`
5. `@/lib/*`
6. `@/interfaces/*` & `@/types/*`
7. `@/*` (other absolute aliases)
8. `./*` (same-directory relative imports only)
