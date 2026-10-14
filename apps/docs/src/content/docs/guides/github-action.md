---
title: GitHub Action
description: Draft release notes on a schedule and build shipdot.json in CI.
---

The Action runs the same code as the CLI. It is a JavaScript action on the `node24` runtime, bundled into the repository, so it starts in about a second.

## Draft notes every week

```yaml title=".github/workflows/shipdot.yml"
name: shipdot
on:
  workflow_dispatch:
  schedule:
    - cron: '0 9 * * 1' # Mondays 09:00 UTC

permissions:
  contents: read

jobs:
  draft:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v7
      - uses: pipe1os/shipdot@v0
        with:
          command: draft
          # Optional LLM mode:
          # llm-provider: anthropic
          # llm-api-key: ${{ secrets.SHIPDOT_LLM_API_KEY }}
```

When there is something to draft, the Action creates the branch `shipdot/draft-YYYY-MM-DD` with one commit and opens a pull request listing every drafted and skipped PR. Review, edit and merge it. If a draft pull request for that day is already open, it does nothing.

:::caution[Repository setting]
For `GITHUB_TOKEN` to open pull requests, enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**. Pull requests opened with `GITHUB_TOKEN` do not trigger other workflows; use a GitHub App token or a fine-grained PAT in `github-token` if you need CI to run on the draft.
:::

## Build in CI

```yaml
      - uses: pipe1os/shipdot@v0
        with:
          command: build
```

`build` needs only `contents: read`. Validation errors show up as annotations on the entry files and fail the job. Most projects run `shipdot build` from their own build script instead.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `command` | `draft` | `draft` or `build`. |
| `github-token` | `${{ github.token }}` | Token for the GitHub API. |
| `base-branch` | config, then repo default | Branch PRs are merged into. |
| `llm-provider` | — | `anthropic` or `openai-compatible`. |
| `llm-api-key` | — | From a secret. Masked in logs. |
| `llm-model` | `claude-opus-5-5` for anthropic | Model name. |
| `llm-base-url` | — | For `openai-compatible` providers. |
| `working-directory` | `.` | Folder with `shipdot.config.json`. |

## Outputs

| Output | Description |
| --- | --- |
| `entries` | Entries drafted (`draft`) or built (`build`). |
| `pull-request-url` | URL of the draft pull request. |
| `pull-request-number` | Its number. |

## Security

- Permissions: `contents: write` and `pull-requests: write` only for `draft`; `contents: read` for `build`.
- Pull request titles and bodies are untrusted input. The Action never puts them in a shell or `${{ }}` expression; it talks to GitHub only through the REST API (Git Data API for the commit).
- Text from PRs is escaped in the draft pull request body (no HTML, no `@mentions`).
- `github-token` and `llm-api-key` are masked with `core.setSecret`. See [LLM mode](/shipdot/guides/drafting/#llm-mode-bring-your-own-key) for exactly what is sent to the model.
- Pin the Action to a full commit SHA if your policy requires it: `uses: pipe1os/shipdot@<sha> # v0.1.0`.
