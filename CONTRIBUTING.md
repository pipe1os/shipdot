# Contributing to shipdot

Thanks for helping! This guide covers everything you need to send a pull request. By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

You need **Node.js 24 or newer** (see [`.nvmrc`](.nvmrc)) and **pnpm** (the version is pinned in `package.json` → `packageManager`; run `corepack enable` or install pnpm globally).

```bash
git clone https://github.com/pipe1os/shipdot.git
cd shipdot
pnpm install
pnpm build
pnpm test
```

For end-to-end tests, install the Playwright browser once:

```bash
pnpm exec playwright install chromium
```

## Repository structure

| Path | What lives there |
| --- | --- |
| `packages/shipdot` | The `<ship-dot>` web component (npm `shipdot`). Zero runtime dependencies. |
| `packages/core` | Schema, types, validation and the isomorphic compile pipeline (npm `@shipdot/core`). |
| `packages/cli` | The `shipdot` CLI: `init`, `build`, `validate`, `draft` (npm `@shipdot/cli`). |
| `action/` | GitHub Action source; the bundle in `action/dist` is committed. Metadata in [`action.yml`](action.yml). |
| `apps/docs` | Docs site and playground (Astro Starlight). |
| `examples/` | Minimal integrations: vanilla, React, Vue, Astro, Next.js. |
| `e2e/` | Playwright tests with axe accessibility checks. |
| `docs/adr/` | Architecture decision records. |

## Commands

| Task | Command |
| --- | --- |
| Docs and playground in dev mode | `pnpm dev` |
| Build everything | `pnpm build` |
| Unit tests (Vitest) | `pnpm test` |
| End-to-end tests (Playwright + axe) | `pnpm test:e2e` |
| Lint and format check (Biome) | `pnpm lint` (fix with `pnpm format`) |
| Typecheck (TypeScript 7) | `pnpm typecheck` |
| Widget size budget | `pnpm size` (after `pnpm build`) |
| Docs site | `pnpm docs` / `pnpm docs:build` |
| Rebuild the Action bundle | `pnpm build:action` |
| Add a changeset | `pnpm changeset` |

Before pushing, run `pnpm lint && pnpm typecheck && pnpm test`. If you touched the widget, also run `pnpm build && pnpm size && pnpm test:e2e`.

## Conventions

- **Code**: TypeScript 7, `strict`, ESM. Exported functions need explicit return types (`isolatedDeclarations`). Formatting and linting are Biome's job; don't fight it.
- **Tests**: next to each package in `test/**/*.test.ts`. Test behavior, not implementation details. Browser behavior belongs in `e2e/`.
- **Dependencies**: prefer the platform and the standard library. The widget must never get runtime dependencies, and must stay under **10 KB min+gzip**.
- **Accessibility**: WCAG 2.1 AA. Keyboard support, focus management and contrast are part of "done", and axe runs in CI.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/), one short line, for example `fix(widget): keep focus on the trigger after Esc`.

Read [`AGENTS.md`](AGENTS.md) for the architecture invariants. A pull request that breaks one of them will not be merged.

## Changesets

Published packages (`shipdot`, `@shipdot/core`, `@shipdot/cli`) are versioned with [Changesets](https://github.com/changesets/changesets). If your change affects users of a package, run:

```bash
pnpm changeset
```

pick the packages, the bump (`patch` for fixes, `minor` for features while we are in `0.x`), and write a one-line summary for the changelog. Docs, examples, tests and CI changes don't need one.

## Pull requests

1. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
2. Keep pull requests focused: one change per PR.
3. Fill the template, including the **`### shipdot`** section: it becomes the in-app note for shipdot's own users (we dogfood the project), or write `skip`.
4. CI must be green: lint, typecheck, unit tests, build, size budget, e2e and the Action bundle check.

## Proposing features

Start a thread in [Discussions → Ideas](https://github.com/pipe1os/shipdot/discussions) or open a [feature request](https://github.com/pipe1os/shipdot/issues/new/choose). Good proposals explain the problem first. Keep the project's constraints in mind: no backend, no telemetry, a tiny widget. Items on the [roadmap](PLAN.md#post-mvp--roadmap) are a good place to start.

## Review process

A maintainer usually replies within a week. We review for correctness, tests, accessibility, bundle size and docs. Expect suggestions; it is normal for a PR to go through a couple of rounds. Once approved and green, a maintainer squash-merges it.

## Good first issues

Look for the [`good first issue`](https://github.com/pipe1os/shipdot/labels/good%20first%20issue) label. Built-in UI translations for new languages (`packages/shipdot/src/strings.ts`) and new framework examples are great first contributions.

## Security

Never report vulnerabilities in public. See [SECURITY.md](SECURITY.md).
