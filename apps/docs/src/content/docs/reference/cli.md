---
title: CLI reference
description: shipdot init, build, validate and draft.
---

```bash
npm install --save-dev @shipdot/cli
npx shipdot <command> [options]
```

Requires Node.js 24 or newer. Output is colored when the terminal supports it and respects `NO_COLOR`.

## Global options

| Option | Description |
| --- | --- |
| `--cwd <dir>` | Run as if shipdot was started in `<dir>`. |
| `--config <file>` | Path to the config file (default `shipdot.config.json`). |
| `-h`, `--help` | Show help, or help for a command (`shipdot draft --help`). |
| `-v`, `--version` | Show the version. |

## `shipdot init`

Creates `shipdot.config.json` and `.shipdot/entries/<today>-welcome.md`, then prints the widget and workflow snippets. Existing files are never overwritten.

| Option | Description |
| --- | --- |
| `--out-dir <dir>` | Folder your site serves as-is. Default: `public/`, or `static/` if present. |
| `--locales <list>` | Comma-separated locales, default first. Default: `en`. |

## `shipdot build`

Validates every entry and translation, renders Markdown to sanitized HTML and writes:

- `<outDir>/shipdot.json`, the [feed](/shipdot/reference/feed/);
- `<outDir>/llms.txt`, a [llms.txt](https://llmstxt.org/) list of updates with one-line summaries;
- `<outDir>/llms-full.txt`, every update with its full Markdown text;
- `<outDir>/shipdot-assets/`, relative images referenced by entries.

Nothing is written if there are errors (exit code 1).

## `shipdot validate`

Same checks as `build`, without writing. Prints `file:line:column - error: message` for each problem and exits with 1 on errors. Checks include missing or invalid `date`, unknown `type`, duplicate IDs, invalid `link`/`image`, missing images, orphan translations, undeclared locales and unknown keys (warning).

## `shipdot draft`

Drafts entries from pull requests merged since the last release. See [Drafting from pull requests](/shipdot/guides/drafting/).

| Option | Description |
| --- | --- |
| `--repo <owner/name>` | Default: `GITHUB_REPOSITORY` or the `origin` remote. |
| `--base <branch>` | Default: `draft.baseBranch` or the repository default branch. |
| `--since <date>` | Only PRs merged after this date (`YYYY-MM-DD` or ISO). Default: latest tag, then latest entry. |
| `--limit <n>` | Maximum number of PRs to look at (default 50). |
| `--dry-run` | Print the drafts instead of writing them. |
| `--no-llm` | Template mode even if an LLM is configured. |

| Environment variable | Description |
| --- | --- |
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub token. Falls back to `gh auth token`. |
| `GITHUB_API_URL` | For GitHub Enterprise Server. |
| `SHIPDOT_LLM_PROVIDER`, `SHIPDOT_LLM_API_KEY`, `SHIPDOT_LLM_MODEL`, `SHIPDOT_LLM_BASE_URL` | [LLM mode](/shipdot/guides/drafting/#llm-mode-bring-your-own-key). |

## Programmatic API

`@shipdot/cli` also exports its building blocks (`loadProject`, `buildProject`, `draftEntries`, `GitHub`, `run`…) for custom tooling. The isomorphic compiler is in `@shipdot/core/compile`:

```js
import { compile } from '@shipdot/core/compile'

const { feed, diagnostics, llms } = compile(
  [{ path: '2026-10-14-export.md', content: '---\ndate: 2026-10-14\ntype: new\ntitle: Export\n---\nHi' }],
  { defaultLocale: 'en', locales: ['en'] },
)
```
