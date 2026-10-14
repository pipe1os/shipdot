---
title: Config reference
description: Every option of shipdot.config.json.
---

```json title="shipdot.config.json"
{
  "$schema": "https://unpkg.com/@shipdot/core/schema/config.json",
  "name": "Acme",
  "description": "Product updates for Acme.",
  "url": "https://acme.example",
  "entriesDir": ".shipdot/entries",
  "outDir": "public",
  "defaultLocale": "en",
  "locales": ["en", "es"],
  "llm": { "provider": "anthropic", "model": "claude-opus-5-5" },
  "draft": {
    "baseBranch": "main",
    "ignoreLabels": ["skip-shipdot"],
    "excludeTypes": ["chore", "ci", "test", "docs", "refactor", "build", "style", "revert"],
    "excludeAuthors": ["dependabot[bot]", "renovate[bot]", "github-actions[bot]"]
  }
}
```

The `$schema` line gives you autocompletion and validation in most editors. Every key is optional; unknown keys are reported as errors.

| Key | Default | Description |
| --- | --- | --- |
| `name` | — | Product name, used in the `llms.txt` title. |
| `description` | — | One-line summary for `llms.txt`. |
| `url` | — | Public URL where the files are served. Adds a link to `llms-full.txt` in `llms.txt`. |
| `entriesDir` | `.shipdot/entries` | Folder with the Markdown entries. |
| `outDir` | `public` | Where `shipdot.json`, `llms.txt`, `llms-full.txt` and `shipdot-assets/` are written. |
| `defaultLocale` | `en` | Language of the main entry files. |
| `locales` | `[defaultLocale]` | Every locale you translate into. The default locale is added if missing. |
| `llm.provider` | — | `anthropic` or `openai-compatible`. The API key is only read from `SHIPDOT_LLM_API_KEY`. |
| `llm.model` | `claude-opus-5-5` (anthropic) | Model name. |
| `llm.baseUrl` | provider default | Custom endpoint, for example a local OpenAI-compatible server. |
| `draft.baseBranch` | repo default branch | Branch the PRs are merged into. |
| `draft.ignoreLabels` | `["skip-shipdot"]` | PRs with any of these labels are skipped. |
| `draft.excludeTypes` | see above | Conventional commit types that never produce an entry. |
| `draft.excludeAuthors` | see above | Logins to skip, in addition to every `[bot]` account. |

Environment variables override the `llm` settings: see [Drafting](/shipdot/guides/drafting/#llm-mode-bring-your-own-key).
