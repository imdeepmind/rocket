# AGENTS.md — ROSS Documentation

Rules and conventions for authoring and maintaining the ROSS documentation site.

## Documentation Rules

1. **No Horizontal Rules (`---`) in Content:**
   - The only allowed `---` is the file's opening and closing frontmatter at the top of the file:

     ```markdown
     ---
     sidebar_position: 4
     ---
     ```

   - Horizontal rule dividers (`---`) anywhere else in the document are strictly disallowed. Use standard markdown section headings (`##`, `###`) or whitespace instead.

2. **Verify Code Before Writing Documentation:**
   - Always verify the actual implementation in the codebase before writing, updating, or explaining any feature.
   - **Only check ROSS code** (`ross/src/`). Do not look at or infer behavior from external projects or other monorepo directories.

3. **No Bug Descriptions:**
   - Never document bugs, known flaws, or temporary buggy behaviors in user-facing documentation.
   - If a bug has already been raised as an issue, assume it is already fixed and document the intended, correct specification and behavior.

## Commands

Run commands from the `ross/docs` directory:

| Command | Action |
| --- | --- |
| `npm run lint:md` | Run markdownlint across all docs (`docs/**/*.md`) |
| `npm run build` | Build Docusaurus production bundle |
| `npm run start` | Start local dev server for documentation |
| `npm run typecheck` | Run TypeScript type checking |

Always run `npm run lint:md` and `npm run build` to verify your changes before submitting.
