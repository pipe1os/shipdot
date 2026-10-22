---
title: Why shipdot
description: What shipdot is designed for, and when it is a good fit.
---

shipdot is built around a few ideas:

- **Point at the feature, don't just announce it.** Hotspots put a dot on the exact element a new feature lives in.
- **Release notes are reviewed like code.** Entries are Markdown files in your repository. `shipdot draft` writes them from merged pull requests and a human reviews them in a pull request before they ship.
- **Every user reads them in their language.** Translations are sibling files, with per-entry fallback.
- **Nothing to operate.** A static `shipdot.json`, a web component under 10 KB, no backend, no account and no tracking. Read state stays in the user's browser.
- **AI assistants know what changed.** `llms.txt` and `llms-full.txt` are generated with every build.

## When shipdot is a good fit

- Your product team already ships through pull requests, and you want release notes reviewed like code.
- You want to point users at the new button, not just tell them it exists.
- You serve users in more than one language.
- You can't or don't want to add a third-party script, account or data processor.

## When it isn't (yet)

- You need analytics on who read what, user segmentation or A/B tests. These are on the [roadmap](https://github.com/pipe1os/shipdot/blob/main/PLAN.md#post-mvp--roadmap) as opt-in features.
- Non-technical editors need a web dashboard without GitHub access.
