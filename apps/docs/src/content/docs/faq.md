---
title: FAQ
description: Common questions about shipdot.
---

## Does shipdot track my users?

No. The widget fetches your `shipdot.json` and nothing else. Read state is a list of entry IDs in the user's `localStorage`. There is no analytics, no cookie and no third-party request.

## Why is nothing unread when I first open my app?

By default, a first visit marks everything already published as read, so new users aren't greeted by your whole history. Use `first-visit="show-latest"` to keep the newest entry unread, or clear the `shipdot:default` key in localStorage while testing.

## How do I show the panel from my own menu item?

Put your own element inside `<ship-dot>` (it replaces the bell), or call `document.querySelector('ship-dot').open()`. See [Theming](/shipdot/guides/theming/#your-own-trigger).

## Can I use it without GitHub?

Yes. `init`, `build` and `validate` only read files. Only `draft` and the Action talk to GitHub.

## Is the HTML in entries safe?

`shipdot build` renders Markdown and sanitizes it with a strict allowlist (no scripts, iframes, styles, event handlers or `javascript:` URLs). The widget trusts `shipdot.json`, so serve it from your own site. Details in [ADR 0002](https://github.com/pipe1os/shipdot/blob/main/docs/adr/0002-sanitize-html-at-build-time.md).

## What does LLM mode send to the provider?

Only each pull request's title and body, plus the instructions. Never code, diffs, file names or author data. See [what is sent, exactly](/shipdot/guides/drafting/#what-is-sent-exactly).

## How big is the widget?

About 7.6 KB min+gzip with zero dependencies. CI fails the build above 10 KB.

## Does it work with server-side rendering?

Yes. Importing `shipdot` on the server is a no-op; the element upgrades in the browser. See the [Next.js guide](/shipdot/frameworks/next/).

## Can read state follow a user across devices?

Yes, if your app has user accounts: store the IDs from the `shipdot:read` event on your server and pass them back with `markRead(ids)`. See [Syncing read state across devices](/shipdot/reference/widget/#syncing-read-state-across-devices).

## Can I have two widgets with different feeds?

Yes. Give each one its own `storage-key` so their read states don't mix. Widgets that show the same feed (a desktop header and a mobile menu, say) can share a key: reads in one clear the other, and hotspots are drawn once.

## Which browsers are supported?

Chrome and Edge 123+, Firefox 125+, Safari 17.5+.
