---
title: Drafting from pull requests
description: Turn merged pull requests into user-facing drafts, offline by default or with your own LLM key.
---

```bash
npx @shipdot/cli draft            # writes draft entries
npx @shipdot/cli draft --dry-run  # prints them instead
```

`shipdot draft` reads pull requests merged into the base branch and writes one entry per user-facing change. It never publishes anything: drafts are files you review, edit and commit (or that the [GitHub Action](/shipdot/guides/github-action/) puts in a pull request for review).

## Which pull requests

- **Base branch**: `--base`, else `draft.baseBranch` in the config, else the repository default branch.
- **Since**: `--since <date>`, else the date of the most recent tag, else the date of your newest entry.
- **Skipped**, with the reason printed for each:
  - PRs labeled `skip-shipdot` (configurable with `draft.ignoreLabels`);
  - bot authors (any `[bot]` account, plus `draft.excludeAuthors`);
  - non-user [Conventional Commit](https://www.conventionalcommits.org/) types: `chore`, `ci`, `test`, `docs`, `refactor`, `build`, `style`, `revert` (configurable with `draft.excludeTypes`);
  - PRs that already have an entry (entries written by `draft` record the PR number in `pr:`);
  - shipdot's own draft PRs;
  - PRs whose `### shipdot` section says `skip`.

Authentication: `GITHUB_TOKEN` or `GH_TOKEN`, falling back to `gh auth token` if the GitHub CLI is installed. The repository comes from `--repo`, `GITHUB_REPOSITORY`, or the `origin` remote.

## Template mode (default)

Offline and deterministic. For each PR:

1. If the description has a **`### shipdot`** section, its content is the note. The first lines can set `title:`, `type:`, `target:` and `link:`.
2. Otherwise the title comes from the PR title without its conventional prefix (`feat(export): add excel export (#12)` → "Add excel export"), and the type from the prefix (`feat` → new, `fix` → fixed, anything else → improved).

```md title="Pull request description"
## What changed
Refactors the exporter and adds an XLSX writer.

### shipdot
title: Export to Excel
type: new
target: "#btn-export"

You can now export any report to Excel with one click.
```

Writing `skip` as the only content of the section opts the PR out. shipdot's own [pull request template](https://github.com/pipe1os/shipdot/blob/main/.github/PULL_REQUEST_TEMPLATE.md) includes this section; copy it into yours.

## LLM mode (bring your own key)

Set these environment variables to let a model rewrite drafts in user language and translate them into every configured locale:

| Variable | Description |
| --- | --- |
| `SHIPDOT_LLM_PROVIDER` | `anthropic` or `openai-compatible` (also settable as `llm.provider` in the config) |
| `SHIPDOT_LLM_API_KEY` | Your API key. Only ever read from the environment. |
| `SHIPDOT_LLM_MODEL` | Model name. Defaults to `claude-opus-5-5` for `anthropic`; required for `openai-compatible`. |
| `SHIPDOT_LLM_BASE_URL` | Base URL for `openai-compatible` providers (default `https://api.openai.com/v1`), for example a local Ollama or vLLM server. |

Requests use plain `fetch`, no SDKs. A PR with a `### shipdot` section keeps its human-written note and is not sent to the model. Use `--no-llm` to force template mode.

### What is sent, exactly

For each pull request without a `### shipdot` section, one request containing:

- the PR **title** (up to 300 characters) and **body** (up to 6,000 characters);
- the instructions, the default locale, and the list of locales to translate into.

**Nothing else**: no diffs, code, file names, commits, comments, labels, author names or repository details.

### Prompt-injection safeguards

PR text is written by contributors and is treated as untrusted:

- It is wrapped in `<pull_request>` tags, with `<`, `>` and `&` escaped so it can't close them.
- The system prompt says the content is data, not instructions, and must not change the output format.
- The reply must be a JSON object that passes validation: a known `type`, a single-line plain-text title of at most 100 characters, a body of at most 1,500 characters, and translations only for configured locales.
- Anything else (invalid JSON, schema violations, a refusal, an HTTP error) falls back to template mode for that PR, with a warning.
- Drafts are always reviewed by a human in a pull request, and the body is sanitized again by `shipdot build`.

The API key is never logged, and in the Action it is masked with `core.setSecret`.
