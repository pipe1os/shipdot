---
title: How it works
description: From a merged pull request to a hotspot in your app, with a human review in between.
---

```text
merged PRs ──► shipdot draft ──► PR with draft entries ──► human review & merge
                                                                  │
                                         .shipdot/entries/*.md ◄──┘
                                                  │
                                           shipdot build
                                                  │
                     ┌────────────────────────────┼─────────────────────────┐
                     ▼                            ▼                         ▼
               shipdot.json                   llms.txt                llms-full.txt
                     │
            <ship-dot src="/shipdot.json">
                     │
       bell + unread badge, feed panel, hotspots on target elements
```

1. **You merge pull requests** as usual. Optionally, authors describe the change for users in a `### shipdot` section of the PR description.
2. **`shipdot draft`** (locally or in the [GitHub Action](/shipdot/guides/github-action/)) lists PRs merged since the last tag, skips the ones users will not notice, and writes one Markdown entry per PR. With an LLM key it can also rewrite and translate them.
3. **A human reviews** the drafts in a pull request: fix the wording, add a `target` for a hotspot, merge.
4. **`shipdot build`** validates the entries and compiles them into a static `shipdot.json`. HTML is sanitized here, with a strict allowlist, so the widget never has to.
5. **`<ship-dot>`** fetches `shipdot.json`, compares entry IDs with the ones stored in `localStorage`, shows the unread count, and puts hotspots on the elements that unread entries point at.

There is no server, database, account or tracking. Deploy `shipdot.json` with the rest of your static files.

## Design decisions

The reasoning behind these choices lives in the architecture decision records:

- [Git is the source of truth for entries](https://github.com/pipe1os/shipdot/blob/main/docs/adr/0001-git-as-source-of-truth.md)
- [Sanitize HTML at build time, not in the widget](https://github.com/pipe1os/shipdot/blob/main/docs/adr/0002-sanitize-html-at-build-time.md)
- [No backend and no telemetry](https://github.com/pipe1os/shipdot/blob/main/docs/adr/0003-no-backend.md)
- [Versioned feed format](https://github.com/pipe1os/shipdot/blob/main/docs/adr/0004-feed-format-v1.md)
