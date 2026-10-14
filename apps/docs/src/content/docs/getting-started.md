---
title: Getting started
description: Add an in-app "What's new" feed with hotspots to any web app in three steps.
---

shipdot has three pieces: Markdown **entries** in your repository, the **CLI** that compiles them into `shipdot.json`, and the **`<ship-dot>` web component** that shows them in your app. You need Node.js 24 or newer for the CLI.

## 1. Create the config and a first entry

Run this in the root of your web app:

```bash
npx @shipdot/cli init
```

It creates:

- `shipdot.config.json` with sensible defaults (`outDir` is `public/`, or `static/` if that folder exists).
- `.shipdot/entries/<today>-welcome.md`, an example entry.

Existing files are never overwritten. Add `--locales en,es` if you plan to translate.

## 2. Write entries and build

An entry is a Markdown file with frontmatter:

```md title=".shipdot/entries/2026-10-14-export-excel.md"
---
date: 2026-10-14
type: new            # new | improved | fixed
title: Export to Excel
target: "#btn-export" # optional: puts a hotspot on this element
---
You can now export any report to Excel with one click.
```

Compile the entries:

```bash
npx @shipdot/cli build
```

This validates every entry, renders Markdown to sanitized HTML and writes `public/shipdot.json`, `public/llms.txt` and `public/llms-full.txt`. Add it to your build script so the feed is always fresh:

```json title="package.json"
{
  "scripts": {
    "build": "shipdot build && vite build"
  },
  "devDependencies": {
    "@shipdot/cli": "^0.1.0"
  }
}
```

## 3. Add the widget

From a CDN:

```html
<script type="module" src="https://unpkg.com/shipdot"></script>
<ship-dot src="/shipdot.json"></ship-dot>
```

Or from npm (`npm install shipdot`), then import it once on the client:

```js
import 'shipdot'
```

That's it. Users see a bell with an unread count. When an unread entry has a `target`, a pulsing dot appears on that element.

:::tip[Seeing nothing on the first visit?]
By default, the first visit marks every existing entry as read, so new users are not greeted by your whole history. Use `first-visit="show-latest"` to keep the newest entry unread, or clear the `shipdot:default` key in localStorage.
:::

## Next steps

- Let shipdot [draft entries from your pull requests](/shipdot/guides/drafting/).
- Automate it with the [GitHub Action](/shipdot/guides/github-action/).
- See the [framework guides](/shipdot/frameworks/react/) for React, Vue, Svelte, Astro and Next.js.
- Customize colors and the trigger in [Theming](/shipdot/guides/theming/).
