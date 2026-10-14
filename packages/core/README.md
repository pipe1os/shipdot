# @shipdot/core

Types, validation and the JSON Schema of the `shipdot.json` feed (v1), plus the isomorphic compile pipeline used by [`@shipdot/cli`](https://www.npmjs.com/package/@shipdot/cli) and the docs playground.

```js
import { validateFeed, resolveLocale } from '@shipdot/core'
import { compile, renderMarkdown } from '@shipdot/core/compile'

const { feed, diagnostics, llms } = compile(
  [{ path: '2026-10-14-export.md', content: '---\ndate: 2026-10-14\ntype: new\ntitle: Export\n---\nHi' }],
  { defaultLocale: 'en', locales: ['en'] },
)
```

- `@shipdot/core`: `Feed`, `FeedEntry`, `ShipdotConfig` types, `validateFeed()`, `resolveConfig()`, `resolveLocale()`.
- `@shipdot/core/compile`: frontmatter parsing with line numbers, validation, Markdown to sanitized HTML (allowlist), `llms.txt` generation. No Node.js APIs: it also runs in the browser.
- JSON Schemas: `https://unpkg.com/@shipdot/core/schema/v1.json` and `schema/config.json`.

- [Feed format](https://pipe1os.github.io/shipdot/reference/feed/)
- [Repository](https://github.com/pipe1os/shipdot)

MIT License
