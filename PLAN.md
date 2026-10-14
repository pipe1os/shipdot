# PLAN.md

Source of truth for shipdot's progress. Agents: read [`AGENTS.md`](./AGENTS.md) first, then pick up the first unchecked item below. Tick boxes as you go and append to the **Status log** at the end.

Target: **MVP v0.1.0** (not published).

## Phase 0 — Tooling and monorepo

- [x] pnpm workspace (`packages/*`, `apps/*`, `examples/*`, `action`), `packageManager` pinned
- [x] TypeScript 7 (`typescript@^7`) shared `tsconfig.base.json`: `strict`, ESM, `isolatedDeclarations` in publishable packages, no options deprecated in 6.0
- [x] tsdown for library builds (ESM + `.d.ts` via oxc), verified to work with TS 7
- [x] Vitest (root projects config), Biome, size-limit, Changesets, Playwright configs
- [x] `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`
- [x] CI workflow skeleton with SHA-pinned actions and minimal permissions

**Acceptance**: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass on an empty-but-wired workspace; CI runs on Node 24 and 26.

## Phase 1 — Community files and repo governance

- [x] `LICENSE` (MIT), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`
- [x] Issue forms (`bug_report.yml`, `feature_request.yml`, `config.yml`), PR template with `### shipdot` section
- [x] `CODEOWNERS`, `FUNDING.yml` (commented template), `dependabot.yml`
- [x] Workflows: `codeql.yml`, `scorecard.yml`
- [x] ADRs in `docs/adr/` (git as source of truth, sanitize at build, no backend, feed format v1)
- [x] Repo description and topics applied with `gh repo edit`

**Acceptance**: every file listed in spec §5.7 exists (README is finished in phase 10); commands quoted in CONTRIBUTING match `AGENTS.md`.

## Phase 2 — `@shipdot/core`: schema, types, validation

- [x] Types: `Feed`, `FeedEntry`, `EntryType`, `ShipdotConfig`, `Diagnostic`
- [x] JSON Schemas: `schema/v1.json` (feed) and `schema/config.json`
- [x] `validateFeed()` (used by tests and LLM output checks) and `resolveLocale()`
- [x] `@shipdot/core/compile`: frontmatter parsing with line numbers, entry validation, translation pairing, Markdown → sanitized HTML (allowlist), relative asset collection, `shipdot.json` and `llms.txt`/`llms-full.txt` generation
- [x] Unit tests: parsing, every validation error, sanitization (XSS vectors), i18n pairing, ordering

**Acceptance**: core has ≥ 90% line coverage on validation/sanitization; XSS fixtures (script, `javascript:` links, event handlers, `data:` images, iframes) are all neutralized.

## Phase 3 — `@shipdot/cli`: `init`, `build`, `validate`

- [x] `shipdot init` (config + example entry + widget and Action snippets; refuses to overwrite)
- [x] `shipdot build` (writes `shipdot.json`, `llms.txt`, `llms-full.txt`, copies relative assets)
- [x] `shipdot validate` (`file:line:col` errors, exit code 1 on failure)
- [x] `--help` per command, `--version`, `--cwd`, `--config`; colored output that respects `NO_COLOR`
- [x] Fixture-based tests for each command

**Acceptance**: `shipdot init && shipdot build` in an empty dir produces a valid feed; `shipdot validate` on broken fixtures prints file and line for duplicate ids, invalid dates, unknown `type`, orphan translations and undeclared locales, and exits 1.

## Phase 4 — Widget: feed, counter, read state

- [x] `<ship-dot>` custom element, Shadow DOM, SSR-safe import
- [x] Attributes: `src`, `mode` (popover/drawer/modal), `locale`, `theme`, `first-visit`, `storage-key`
- [x] Trigger button with unread badge and `aria-label` with count; default slot for a custom trigger
- [x] Popover (Popover API), drawer and modal (`<dialog>`), Esc closes, focus returns to trigger
- [x] Read state in `localStorage` (`shipdot:<storage-key>`), bounded, try/catch, in-memory fallback
- [x] API: `open()`, `close()`, `markAllRead()`, `replayLatest()`, `refresh()`; events `shipdot:ready|open|close|read|error`
- [x] `::part()`s and documented CSS custom properties; light/dark/auto themes with AA contrast
- [x] Framework typings (React 19, Vue, Svelte, Astro)
- [x] size-limit budget ≤ 10 KB min+gzip in CI

**Acceptance**: unit tests for state/storage; e2e: open/close, counter, persistence after reload, keyboard navigation, axe passes on the open panel in every mode.

## Phase 5 — Widget: hotspots

- [x] Overlay layer (fixed, own shadow root) appended to `<body>`
- [x] Positioning with `getBoundingClientRect`, `ResizeObserver`, rAF-throttled scroll/resize
- [x] `MutationObserver` for late targets (SPA), disconnected when nothing is pending
- [x] Hidden when the target is not visible; `max-hotspots`; `hotspots="off"`
- [x] Tooltip with title, body, "Got it" (marks read); Esc closes; `shipdot:hotspot-click`
- [x] `prefers-reduced-motion`

**Acceptance**: e2e: hotspot appears over the target, follows scroll, hides when the target is hidden, appears for a target added late, is keyboard reachable, and marking it read removes it across reloads.

## Phase 6 — i18n end to end

- [x] Translation files (`entry.es.md`) compiled into `i18n` map; undeclared locales and orphans are errors
- [x] Widget locale resolution (`locale` attribute → `navigator.languages` → `defaultLocale`), per-entry fallback
- [x] Built-in UI strings for en, es, pt; dates formatted with `Intl.DateTimeFormat`
- [ ] Example entries translated (en/es/pt) in `.shipdot/entries/` and the examples

**Acceptance**: unit + e2e test: `locale="es"` shows Spanish entries and UI; a missing translation falls back to the default locale.

## Phase 7 — `shipdot draft` from PRs

- [ ] GitHub REST client (fetch): merged PRs into base branch since last tag (GraphQL) or latest entry date; `--since` override
- [ ] Filters: `skip-shipdot` label, bot authors, non-user conventional types (configurable)
- [ ] Template mode: `### shipdot` section (`title:`, `type:`, `target:` header lines, `skip`), else title derived from PR title
- [ ] LLM mode (BYOK): `anthropic` and `openai-compatible` via fetch; delimiters + system prompt; JSON output validated; translations for configured locales; fallback to template mode
- [ ] Skip PRs that already have an entry (`pr:` frontmatter field)
- [ ] Tests with mocked `fetch`

**Acceptance**: `shipdot draft --dry-run` against `pipe1os/shipdot` lists real merged PRs in template mode; LLM mode tests cover success, invalid JSON, schema violations and prompt-injection-shaped bodies.

## Phase 8 — GitHub Action

- [ ] `action.yml` (root), `runs.using: node24`, bundle in `action/dist/index.js`
- [ ] Inputs: `command`, `github-token`, `base-branch`, `llm-provider`, `llm-api-key`, `llm-model`, `llm-base-url`, `working-directory`; outputs
- [ ] `draft`: creates branch `shipdot/draft-YYYY-MM-DD` and opens a PR via the REST API (no shell)
- [ ] `build`: runs the build in `working-directory`
- [ ] Secrets masked with `core.setSecret`; CI checks `action/dist` is up to date
- [ ] Workflows: `shipdot.yml` (dogfooding), example workflow in README and `examples/`

**Acceptance**: unit tests with mocked GitHub API; `check:action` passes in CI.

## Phase 9 — Docs site, playground, examples

- [ ] Astro Starlight site in `apps/docs`: getting started, widget/CLI/Action/config reference, i18n, theming, hotspots, LLM privacy, framework guides, FAQ
- [ ] Playground: entry editors (Markdown) + live widget on a fake dashboard with an "Export" button hotspot; mode/theme/locale switches; compiled with the same `@shipdot/core/compile` pipeline as the CLI
- [ ] `docs.yml`: build on PRs, deploy to GitHub Pages from `main`
- [ ] `examples/`: vanilla, react, vue, astro, next (minimal, working, each with README)

**Acceptance**: `pnpm docs:build` succeeds; every example builds; `examples/vanilla` runs `shipdot init → entry → build` and shows the entry with a hotspot.

## Phase 10 — Release readiness v0.1.0 (not published)

- [ ] README (EN) at top-OSS level with real Playwright-generated screenshot; `README.es.md` full translation
- [ ] `llms.txt` for the repo
- [ ] `release.yml`: Changesets + npm provenance/trusted publishing, gated until npm is configured
- [ ] Initial changeset for v0.1.0
- [ ] `pnpm -r pack --dry-run`: `exports`, types, `files`, `license`, `repository`, `README` correct
- [ ] Definition of Done (below) verified from a clean clone

## Definition of Done (MVP)

- [ ] `pnpm install && pnpm build && pnpm test && pnpm test:e2e && pnpm lint && pnpm typecheck` green from a clean clone
- [ ] Widget ≤ 10 KB min+gzip (size-limit)
- [ ] `shipdot init` → entry → `shipdot build` → widget with hotspot works in `examples/vanilla`
- [ ] `shipdot draft` works in template mode against this repo; LLM mode tested with mocked fetch
- [ ] Action has an up-to-date `action/dist` and an example workflow
- [ ] i18n end to end (en + es at least) with fallback
- [ ] Docs + playground build; Pages workflow ready
- [ ] All §5.7 files exist and are consistent (same commands and names in README, CONTRIBUTING, AGENTS.md, docs)
- [ ] Packages pack correctly
- [ ] Initial changeset for v0.1.0
- [ ] PLAN.md fully ticked with a complete status log
- [ ] Everything pushed to `main`

## Post-MVP / Roadmap

- Analytics (opt-in, self-hosted friendly)
- Segmentation by user, plan or role
- A/B testing of announcements
- RSS/Atom feed output
- Publishing to Slack, Discord and email
- Web admin panel for non-technical editors
- Syncing read state across devices
- More built-in UI locales
- "Show me" from the feed: scroll to and highlight an entry's target

## Notes and deviations

- **Compile pipeline lives in `@shipdot/core/compile`, not in the CLI.** It is isomorphic (unified + rehype-sanitize + yaml, no Node APIs), so the docs playground runs exactly the same parsing and sanitization as `shipdot build`. The CLI only does file IO. Sanitization still happens at build time, never in the widget.
- **`draft.excludeTypes` instead of "types to include".** Excluding non-user types (`chore`, `ci`, …) keeps PRs with non-conventional titles, which a strict include list would silently drop.
- **Opening the feed marks every entry as read**, which also removes their hotspots. A separate "read in feed" vs "dismissed hotspot" state would need a second store; deferred (see roadmap "Show me").
- **No "Mark all as read" button in the panel**: opening already marks everything read; `markAllRead()` stays in the JS API.
- **Explicit Tab wrap-around in drawer/modal.** Chrome lets Tab leave a modal `<dialog>` for the browser UI; the widget wraps focus inside instead.
- **Framework typings ship as opt-in subpaths** (`shipdot/react`, `shipdot/vue`, `shipdot/svelte`, `shipdot/astro`) so the main types never require React/Vue/Svelte to be installed.
- **CI matrix Node 24 + 26.** Node 24 is the active LTS (minimum in `engines`); Node 26 becomes LTS on 2026-10-28. Node 22 is in maintenance and below the required minimum.

## Status log

- 2026-10-14 — Setup: repository cloned (empty), `main` confirmed; npm names `shipdot`, `@shipdot/cli`, `@shipdot/core` available (the `@shipdot` org must be created manually). `AGENTS.md`, `CLAUDE.md` and `PLAN.md` written.
- 2026-10-14 — Phase 0: pnpm 12 workspace, TypeScript 7.0.2 (`tsc` only), tsdown 0.23 with oxc `.d.ts` via `isolatedDeclarations`, Vitest 5, Biome 2.5, Playwright 1.64, size-limit, Changesets, CI on Node 24/26.
- 2026-10-14 — Phases 2–3: `@shipdot/core` (schema v1 + config JSON Schemas, validation, compile pipeline with rehype-sanitize allowlist, llms.txt) and `@shipdot/cli` (`init`, `build`, `validate`, `draft` incl. LLM mode). `draft` was written early because it shares the CLI plumbing.
- 2026-10-14 — Phase 1: community files, issue forms, PR template with `### shipdot`, CodeQL and Scorecard (skipped while the repo is private), ADRs 0001–0004.
- 2026-10-14 — Phases 4–5: `<ship-dot>` widget (6.5 KB min+gzip), popover/drawer/modal, read state, events, hotspots overlay with ResizeObserver/MutationObserver; 17 unit tests and 19 Playwright tests with axe (fixed two real contrast issues found by axe).
