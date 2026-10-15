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
- [x] Example entries translated (en/es/pt) in `.shipdot/entries/` and the examples

**Acceptance**: unit + e2e test: `locale="es"` shows Spanish entries and UI; a missing translation falls back to the default locale.

## Phase 7 — `shipdot draft` from PRs

- [x] GitHub REST client (fetch): merged PRs into base branch since last tag (GraphQL) or latest entry date; `--since` override
- [x] Filters: `skip-shipdot` label, bot authors, non-user conventional types (configurable)
- [x] Template mode: `### shipdot` section (`title:`, `type:`, `target:` header lines, `skip`), else title derived from PR title
- [x] LLM mode (BYOK): `anthropic` and `openai-compatible` via fetch; delimiters + system prompt; JSON output validated; translations for configured locales; fallback to template mode
- [x] Skip PRs that already have an entry (`pr:` frontmatter field)
- [x] Tests with mocked `fetch`

**Acceptance**: `shipdot draft --dry-run` against `pipe1os/shipdot` lists real merged PRs in template mode; LLM mode tests cover success, invalid JSON, schema violations and prompt-injection-shaped bodies.

## Phase 8 — GitHub Action

- [x] `action.yml` (root), `runs.using: node24`, bundle in `action/dist/index.js`
- [x] Inputs: `command`, `github-token`, `base-branch`, `llm-provider`, `llm-api-key`, `llm-model`, `llm-base-url`, `working-directory`; outputs
- [x] `draft`: creates branch `shipdot/draft-YYYY-MM-DD` and opens a PR via the REST API (no shell)
- [x] `build`: runs the build in `working-directory`
- [x] Secrets masked with `core.setSecret`; CI checks `action/dist` is up to date
- [x] Workflows: `shipdot.yml` (dogfooding), example workflow in README and `examples/`

**Acceptance**: unit tests with mocked GitHub API; CI checks `action/dist` is up to date (since ADR 0005, `pnpm build` must leave the working tree clean).

## Phase 9 — Docs site, playground, examples

- [x] Astro Starlight site in `apps/docs`: getting started, widget/CLI/Action/config reference, i18n, theming, hotspots, LLM privacy, framework guides, FAQ
- [x] Playground: entry editors (Markdown) + live widget on a fake dashboard with an "Export" button hotspot; mode/theme/locale switches; compiled with the same `@shipdot/core/compile` pipeline as the CLI
- [x] `docs.yml`: build on PRs, deploy to GitHub Pages from `main`
- [x] `examples/`: vanilla, react, vue, astro, next (minimal, working, each with README)

**Acceptance**: `pnpm docs:build` succeeds; every example builds; `examples/vanilla` runs `shipdot init → entry → build` and shows the entry with a hotspot.

## Phase 10 — Release readiness v0.1.0 (not published)

- [x] README (EN) at top-OSS level with real Playwright-generated screenshot; `README_es.md` full translation
- [x] `llms.txt` for the repo
- [x] `release.yml`: Changesets + npm provenance/trusted publishing, gated until npm is configured
- [x] Initial changeset for v0.1.0
- [x] `pnpm -r pack --dry-run`: `exports`, types, `files`, `license`, `repository`, `README` correct
- [x] Definition of Done (below) verified from a clean clone

**Notes**: the README images are rendered from a dedicated stage (`scripts/showcase/stage.html`) instead of the docs playground. The playground crop leaked page content and could not frame the hotspot and the entry that produces it together. The widget, its hotspots and its panel in the images are still the real build, fed by entries compiled with `@shipdot/core/compile`.

## Definition of Done (MVP)

- [x] `pnpm install && pnpm build && pnpm test && pnpm test:e2e && pnpm lint && pnpm typecheck` green from a clean clone
- [x] Widget ≤ 10 KB min+gzip (size-limit)
- [x] `shipdot init` → entry → `shipdot build` → widget with hotspot works in `examples/vanilla`
- [x] `shipdot draft` works in template mode against this repo; LLM mode tested with mocked fetch
- [x] Action has an up-to-date `action/dist` and an example workflow
- [x] i18n end to end (en + es at least) with fallback
- [x] Docs + playground build; Pages workflow ready
- [x] All §5.7 files exist and are consistent (same commands and names in README, CONTRIBUTING, AGENTS.md, docs)
- [x] Packages pack correctly
- [x] Initial changeset for v0.1.0
- [x] PLAN.md fully ticked with a complete status log
- [x] Everything pushed to `main`

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
- **Hotspots use their own color** (`--shipdot-hotspot`, pink by default) instead of the accent, so they stay visible on brand-colored buttons. Tooltips are anchored below the target element, not the dot.
- **No comparison with other projects anywhere** (README, docs). Requested by the maintainer; "Why shipdot" describes shipdot on its own terms. This replaces the comparison table asked for in the original brief.
- **The Spanish README is `README_es.md`** (not `README.es.md`), linked from the top of `README.md`, as requested by the maintainer. No emojis in READMEs except the language flags.
- **Changesets `fixed` group**: `shipdot`, `@shipdot/core` and `@shipdot/cli` share one version while in `0.x`.
- **Type-only optional peer dependencies** on the widget (`@types/react`, `vue`, `svelte`, `astro`) so `shipdot/react` & co. resolve under strict installs (pnpm). They are not runtime dependencies.
- **`pnpm build` includes docs and examples**, so CI proves every example builds. CI builds before type-checking because docs and examples type-check against the built packages. Only the Node 24 job runs the full build; the Node 26 job builds the packages only, since docs and examples exercise Astro, Next.js and Vite rather than shipdot.
- **E2E installs only Chromium's headless shell, without `--with-deps`.** The tests run headless, and the `ubuntu-latest` image already has Chromium's system libraries; `--with-deps` only added fonts the fixtures do not use and cost ~15s of apt.
- **CodeQL, Scorecard and the Pages deploy are skipped while the repository is private** (they need a public repo or a paid plan); they run automatically once it is public.
- **CDN snippets pin `shipdot@<major.minor>` while in `0.x`** (a minor release may break). `shipdot init` derives the pin from its own version (the packages share one version); `scripts/sync-cdn-version.ts` rewrites the pins in every Markdown file during `pnpm version-packages`.
- **README images are WebP**, encoded by the same Chromium that renders them in `scripts/screenshot.ts` (quality 0.95, about a quarter of the PNG size, no new dependency).
- **Logo (2026-10-15 redesign).** A custom geometric wordmark drawn from one circle and one rule, no font involved. The p and d of "shipdot" share a single signal-red ball (`#ee4423`) that sits in front of p's descender and d's ascender, like the Greenwich time ball on its mast, a public signal that never knew who was looking. Ink is `#0f1724` (light) and `#f1f3f6` (dark). The favicon is the p·d ligature alone with heavier stems so it survives 16 px. Each SVG is about 800 bytes.
- **The release workflow tags the Action** (`vX.Y.Z`, and moves `vX`) after Changesets publishes, so `uses: pipe1os/shipdot@v0` keeps resolving. Agents still never create tags themselves.
- **CI matrix Node 24 + 26.** Node 24 is the active LTS (minimum in `engines`); Node 26 becomes LTS on 2026-10-28. Node 22 is in maintenance and below the required minimum.
- **Reproducible builds.** The Windows "dirty `action/dist`" report was not a path or line-ending issue: the v0.1.0 version bump inlined a new CLI version without rebuilding the bundle (CI on `main` failed the same way on Linux; `version-packages` now rebuilds it). The bundle also drops `//#region` comments, whose pnpm store paths could differ per machine. CI checks a clean tree after `pnpm build` on Ubuntu (Node 24 and 26) and Windows (Node 24, the full build), replacing the `check:action` script and step. The Ubuntu jobs keep their `Check (Node N)` names because the `main` ruleset requires them by name, and generated feeds stay gitignored instead of faking `generatedAt` (ADR 0005). Releases keep `pnpm publish`: pnpm 12 does the OIDC exchange and provenance natively, so no switch to `npm publish` was needed.
- **HTML comments are found with a scanner, not the Markdown parser.** micromark takes quadratic time on deeply nested lists and block quotes (minutes for some 65 KB pull request bodies), and capping the depth does not help: lazy lines and repeated shallow nesting are slow too. `packages/core/src/html-comments.ts` follows micromark's rules for containers, code, HTML blocks, definitions, links and inline HTML in linear time. A differential test compares it with remark on random Markdown; reference links are not resolved, which only matters for `<!--` inside a defined reference label.

## Status log

- 2026-10-14 — Setup: repository cloned (empty), `main` confirmed; npm names `shipdot`, `@shipdot/cli`, `@shipdot/core` available (the `@shipdot` org must be created manually). `AGENTS.md`, `CLAUDE.md` and `PLAN.md` written.
- 2026-10-14 — Phase 0: pnpm 12 workspace, TypeScript 7.0.2 (`tsc` only), tsdown 0.23 with oxc `.d.ts` via `isolatedDeclarations`, Vitest 5, Biome 2.5, Playwright 1.64, size-limit, Changesets, CI on Node 24/26.
- 2026-10-14 — Phases 2–3: `@shipdot/core` (schema v1 + config JSON Schemas, validation, compile pipeline with rehype-sanitize allowlist, llms.txt) and `@shipdot/cli` (`init`, `build`, `validate`, `draft` incl. LLM mode). `draft` was written early because it shares the CLI plumbing.
- 2026-10-14 — Phase 1: community files, issue forms, PR template with `### shipdot`, CodeQL and Scorecard (skipped while the repo is private), ADRs 0001–0004.
- 2026-10-14 — Phases 4–5: `<ship-dot>` widget (6.5 KB min+gzip), popover/drawer/modal, read state, events, hotspots overlay with ResizeObserver/MutationObserver; 17 unit tests and 19 Playwright tests with axe (fixed two real contrast issues found by axe).
- 2026-10-14 — Phase 8: GitHub Action (`action.yml`, `node24`, 1.5 MB self-contained bundle in `action/dist`, deterministic and checked in CI), dogfooding workflow `shipdot.yml`, `release.yml` gated behind the `SHIPDOT_RELEASE_ENABLED` repository variable.
- 2026-10-14 — Phase 9: Starlight docs site (23 pages) with the live playground (compiles entries in the browser with `@shipdot/core/compile`), `docs.yml` for GitHub Pages, examples for vanilla, React, Vue, Astro, Next.js and the GitHub Action. Widget tweaks found while building the playground: dedicated hotspot color and tooltips anchored to the target.
- 2026-10-14 — Phase 10: README with Playwright-generated screenshots, `README_es.md`, repo `llms.txt`, package READMEs and licenses, Changesets config and initial v0.1.0 changeset (not published). Tarballs installed in a clean project: `init`, `build`, SSR import and `@shipdot/core/compile` work.
- 2026-10-14 — Definition of Done verified from a clean clone (install, build, 115 unit tests, 19 e2e tests with axe, lint, typecheck, size 6.47 KB, Action bundle up to date). `shipdot draft --dry-run` drafted PR #2 of this repository in template mode from its `### shipdot` section. MVP complete.
- 2026-10-14 — v0.1.0 follow-up: the version bump left `action/dist` stale (the bundle inlines the CLI version), which failed CI on `main`. Bundle rebuilt, and `pnpm version-packages` now rebuilds the Action bundle so release commits and "Version packages" PRs include it.
- 2026-10-15 — README images redesigned: a dedicated showcase stage (`scripts/showcase/`) renders the real widget build and a feed compiled from real entries, in light and dark variants (`<picture>`). The hero pairs the Markdown entry with the hotspot it produces; the panel image now illustrates the Widget section. `scripts/screenshot.ts` no longer needs the docs build.
- 2026-10-15 — Docs: "Copy page" menu next to the title of every Markdown docs page (copy the page as Markdown for LLMs, or view it as plain text). Each page is also served at `<page>.md` by an Astro endpoint, with links made absolute; the MDX pages (home, playground) are left out.
- 2026-10-15 — README review: the Quick start entry no longer starts with an HTML comment (it broke `shipdot build` when pasted), Node.js 24 requirement and a `0.x` status note added, "Why shipdot" and "Features" deduplicated, Action inputs as a table, quoted `target` in PR notes, changelog linked. CDN snippets pinned to `shipdot@0.1` (README, docs, `shipdot init`), images converted to WebP (1.9 MB → 544 KB), logo text outlined, and `release.yml` now tags `vX.Y.Z`/`vX` for the Action. `action.yml` is named "shipdot in-app release notes" because the Marketplace rejected "shipdot" (names must be unique across actions, users and organizations).
- 2026-10-15 — CI: the E2E job installs only Chromium's headless shell, without system packages, and drops a redundant packages build (47s → 27s); the Node 26 job builds the packages only. CI wall time went from about 50s to 38s.
- 2026-10-15 — Release fix: `scripts/sync-cdn-version.ts` failed the Release workflow on `main` with ENOENT because `git ls-files` (which reads the index) still listed the changeset `changeset version` had just deleted. The script now skips `.changeset/`, like `CHANGELOG.md`.
- 2026-10-15 — Security: fixed the open CodeQL alerts in sources. HTML comments are stripped with the Markdown parser by `stripHtmlComments` (`@shipdot/core/compile`), so `<!--` in code spans and code blocks is kept, as GitHub and the widget render it; `shipdot draft` title and `### shipdot` heading regexes no longer backtrack polynomially on untrusted PR text. Adversarial-input tests added (they fail on the old code).
- 2026-10-15 — Reproducible builds: the Action bundle drops `//#region` comments with pnpm store paths (byte-identical on Windows and Linux), CI fails if `pnpm build` leaves the working tree dirty and also runs on `windows-latest` with Node 24, ADR 0005 (generated feeds and copied assets stay gitignored), PowerShell 7 note in CONTRIBUTING, `release.yml` publishes with pnpm trusted publishing (no `registry-url`, no `NPM_TOKEN`), patch changeset for the first CI release.
- 2026-10-15 — Logo redesign: new custom wordmark where p and d share one red ball (README, README_es, docs header, favicon); the concentric indigo rings are gone.
- 2026-10-15 — Security: `stripHtmlComments` (`@shipdot/core/compile`) no longer runs the Markdown parser, which was quadratic on nested lists and block quotes (a list nested 4,000 levels deep took 6 s; lazy lines after a deep block quote, minutes). A linear scanner replaces it and gave remark's output on about 1.5 million fuzzed documents (reference links aside, see Notes). Adds a seeded differential test, adversarial tests for nested lists and block quotes, and a rebuilt `action/dist`.
