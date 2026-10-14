# AGENTS.md

Guidance for AI coding agents (and humans) working on **shipdot**. Read this file and [`PLAN.md`](./PLAN.md) before changing anything. `PLAN.md` is the source of truth for progress.

## Project in 10 lines

shipdot announces new features inside a web app with **no backend, no database and no per-MAU pricing**.

1. Every update is a Markdown file with frontmatter in `.shipdot/entries/`. Git is the CMS.
2. `shipdot draft` (CLI + GitHub Action) turns merged pull requests into draft entries written for end users and opens a PR so a human reviews them before they ship.
3. `shipdot build` compiles entries into `shipdot.json` (for the widget) and `llms.txt` (for AI assistants). HTML is sanitized here, at build time.
4. `<ship-dot>` is a zero-dependency web component (≤ 10 KB min+gzip): a bell with an unread count plus a popover/drawer/modal feed.
5. **Hotspots** are the core differentiator: an entry with `target: "#btn-export"` puts a pulsing dot on that real UI element; clicking it shows the update and marks it read.
6. Multi-language from day one: sibling files like `entry.es.md`, locale picked from the `locale` attribute or `navigator.language`, with fallback.
7. Read state lives in the end user's `localStorage`. Nothing is tracked, nothing phones home.

## Monorepo map

| Path | npm name | What lives there |
| --- | --- | --- |
| `packages/core` | `@shipdot/core` | Types, constants, feed/config validation, locale resolution, JSON Schemas (`schema/v1.json`, `schema/config.json`). Subpath `@shipdot/core/compile`: isomorphic entry parsing, Markdown → sanitized HTML, `shipdot.json` + `llms.txt` generation. |
| `packages/cli` | `@shipdot/cli` (bin `shipdot`) | `init`, `build`, `validate`, `draft`. File IO, config loading, GitHub API client, LLM providers (fetch only). |
| `packages/shipdot` | `shipdot` | The `<ship-dot>` web component. Zero runtime dependencies. Framework typings in `types/`. |
| `action/` | private | GitHub Action source. Bundled to `action/dist/index.js` (committed). Metadata in root `action.yml`. |
| `apps/docs` | private | Astro Starlight docs site + playground, deployed to GitHub Pages. |
| `examples/*` | private | Minimal integrations: vanilla, react, vue, astro, next. |
| `e2e/` | — | Playwright tests (Chromium) + axe accessibility checks. |
| `.shipdot/entries/` | — | Dogfooding: shipdot's own updates. |
| `docs/adr/` | — | Architecture decision records. |

## Commands

Requires Node.js `>=24` (see `.nvmrc`) and pnpm (version pinned in `packageManager`; run `corepack enable` or install pnpm globally).

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev (docs + playground, widget from source) | `pnpm dev` |
| Build everything | `pnpm build` |
| Unit tests (Vitest) | `pnpm test` |
| E2E tests (Playwright + axe) | `pnpm test:e2e` (first time: `pnpm exec playwright install chromium`) |
| Lint + format check (Biome) | `pnpm lint` (auto-fix: `pnpm format`) |
| Typecheck (TypeScript 7 `tsc`) | `pnpm typecheck` |
| Widget size budget | `pnpm size` (run `pnpm build` first) |
| Docs site | `pnpm docs` (dev) / `pnpm docs:build` |
| Rebuild Action bundle | `pnpm build:action` (CI fails if `action/dist` is stale) |
| Add a changeset | `pnpm changeset` |

Run `pnpm lint && pnpm typecheck && pnpm test` before every commit that touches code.

## Conventions

- **Language**: everything in the repo is English, except `README.es.md`.
- **TypeScript 7** (`typescript@^7`, the native Go compiler), `strict`, ESM only. Publishable packages use `isolatedDeclarations`, so exported functions need explicit return types. `.d.ts` files are produced by tsdown via oxc, never by the TypeScript API.
- **No tools that depend on the TypeScript programmatic API** (typescript-eslint, ts-morph, `astro check`, …). TS 7.0 has no stable API (it lands in 7.1). The docs site is not type-checked with `astro check` for this reason; its `.ts` code is checked with `tsc`.
- **Naming**: files `kebab-case.ts`; types `PascalCase`; functions and variables `camelCase`; constants `UPPER_SNAKE_CASE` only for true module-level constants. Custom events are `shipdot:<name>`.
- **Tests**: next to the package in `test/**/*.test.ts`, fixtures in `test/fixtures/`. Unit tests use Vitest (`happy-dom` for the widget). Browser behaviour is covered by Playwright in `e2e/`. Test behaviour, not implementation details.
- **Dependencies**: prefer the platform and the standard library (`node:util` `parseArgs`/`styleText`, native `fetch`, `<dialog>`, Popover API). Every new dependency needs a reason in the PR description.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, `perf:`, `build:`), small and logical. Scope with the package when useful: `feat(widget): …`, `fix(cli): …`.
- **Changesets**: any user-facing change to `shipdot`, `@shipdot/core` or `@shipdot/cli` needs `pnpm changeset`. Private workspaces (docs, examples, action) do not.
- **Pull requests**: fill the `### shipdot` section of the PR template (it becomes the in-app note) or write `skip`.

## Architecture invariants (never break these)

1. **The widget has zero runtime dependencies.** `packages/shipdot/package.json` has no `dependencies`. Type-only imports from `@shipdot/core` are fine.
2. **Widget budget: ≤ 10 KB min+gzip**, enforced by size-limit in CI. If a feature does not fit, it does not ship in the widget.
3. **The widget makes no network requests except fetching `src`** (images authored in entries load as normal `<img>`). No analytics, no fonts, no CDNs.
4. **Every `localStorage` access is wrapped in try/catch** and the widget works without storage (read state is then in-memory only).
5. **HTML is sanitized at build time** (`@shipdot/core/compile`, allowlist: `p`, `a` with http/https/mailto, `strong`, `em`, `code`, `pre`, `ul`, `ol`, `li`, `br`, `h3`, `h4`, `img` with https or relative `src`). The widget never sanitizes at runtime and never builds HTML from untrusted strings: titles and other plain fields are escaped.
6. **Accessibility: WCAG 2.1 AA.** Real `<button>`s, correct ARIA roles, focus management (trap in drawer/modal, Esc closes, focus returns to the trigger), keyboard-reachable hotspots, AA contrast in light and dark themes, `prefers-reduced-motion` respected. axe runs in e2e.
7. **No backend and no telemetry**, anywhere: not in the widget, CLI, Action or docs.
8. **`shipdot.json` is versioned** (`"version": 1`). Breaking changes require a new version number, a new JSON Schema file (`schema/v2.json`) and widget support for both during a deprecation window. Additive optional fields are not breaking.

## GitHub Action security rules

- Pull request titles and bodies are **untrusted input**. Never interpolate them into a shell command, a `run:` step, or `${{ }}` expressions. The Action talks to GitHub through the REST API (no `git` shell-outs with user data).
- Prompt injection: PR content is sent to the LLM inside clearly delimited tags, the system prompt states that the content is data and not instructions, and the model output is parsed as JSON and validated against the entry schema (type enum, length limits, declared locales only). Invalid output falls back to template mode.
- Only the PR **title and body** are ever sent to the LLM. Never diffs, code, file names, comments or author data.
- Never print the LLM API key or the GitHub token. Mask them with `core.setSecret` as soon as they are read.
- Minimal permissions: `contents: read` for `build`; `contents: write` + `pull-requests: write` only for `draft`.
- Workflows pin third-party actions by full commit SHA with a version comment and declare `permissions` explicitly.

## Updating PLAN.md and Definition of Done

- When you start a task, find it in `PLAN.md`. When you finish it, tick the checkbox, and add a dated line to the **Status log** (`YYYY-MM-DD — phase N: what changed`).
- If you deviate from the plan, record the deviation and the reason in the phase's **Notes**.
- A change is **done** when: lint, typecheck and unit tests pass; e2e passes if the widget changed; the widget is still within budget; docs (README, docs site, AGENTS.md) are updated if behaviour or commands changed; a changeset exists for user-facing package changes; `action/dist` is rebuilt if `action/` or its dependencies changed.

## Things an agent must never do

- Publish to npm, create git tags or GitHub releases.
- Change repository settings beyond description and topics.
- `git push --force`, rewrite published history, or create or use a `master` branch (`main` is the default).
- Add telemetry or analytics, or add runtime dependencies to the widget.
- Invent statistics, testimonials, company logos, or badges that do not work.
- Use tools that depend on the TypeScript API, or options deprecated in TypeScript 6.0.
- Commit secrets, tokens or `.env` files.

## Known technical debt

- No `astro check` in `apps/docs` until TypeScript 7.1 ships a stable API.
