---
title: Writing entries
description: The entry file format, frontmatter fields, Markdown support and images.
---

Every update is one Markdown file in the entries folder (`.shipdot/entries/` by default). Subfolders are allowed. The file name without `.md` is the entry ID unless you set `id`.

```md title=".shipdot/entries/2026-10-14-export-excel.md"
---
date: 2026-10-14
type: new
title: Export to Excel
target: "#btn-export"
link: https://example.com/docs/export
image: ./export.png
---
You can now export any report to Excel with one click.
```

## Frontmatter

| Key | Required | Description |
| --- | --- | --- |
| `date` | yes | Release date as `YYYY-MM-DD`. Entries are sorted newest first. |
| `type` | yes | `new`, `improved` or `fixed`. Shown as a colored tag. |
| `title` | yes | Short, plain-text headline. |
| `id` | no | Stable ID used to remember what a user has read. Defaults to the file name. Letters, digits, `.`, `_` and `-`. Changing it makes the entry unread again. |
| `target` | no | CSS selector of the element that gets a [hotspot](/shipdot/guides/hotspots/), like `#btn-export` or `[data-shipdot="export"]`. |
| `link` | no | An http(s) URL shown as "Learn more". |
| `image` | no | An https URL or a path relative to the entry file. Relative images are copied next to `shipdot.json`. |
| `pr` | no | Pull request number. Set by `shipdot draft` so a PR is never drafted twice. Not included in `shipdot.json`. |

Unknown keys produce a warning (typos like `tittle` are caught). `shipdot validate` reports every problem with the file, line and column.

## Body

The body is Markdown. At build time it is rendered to HTML and **sanitized with an allowlist**:

- Allowed tags: `p`, `a`, `strong`, `em`, `code`, `pre`, `ul`, `ol`, `li`, `br`, `h3`, `h4`, `img`.
- Links: `http`, `https` and `mailto` only. External links open in a new tab with `rel="noopener noreferrer"`.
- Images: `https` URLs or relative paths only. Images are lazy-loaded.
- `#` and `##` headings become `<h3>`; `#####` and deeper become `<h4>`.
- Raw HTML in the Markdown is dropped, along with anything not on the list (scripts, iframes, styles, event handlers).

Keep notes short: one to three sentences about what users can do now. Link to your docs for details.

## Images

```md
---
image: ./img/export.png
---
![The export menu](./img/export-menu.png)
```

Relative images (in `image` and in the body) are resolved from the entry file, copied to `<outDir>/shipdot-assets/`, and loaded relative to `shipdot.json`, so the feed works from any URL. Paths that point outside the entries folder are rejected.

## Translations

Add a sibling file with the locale before `.md`. See [Internationalization](/shipdot/guides/i18n/).

```text
2026-10-14-export-excel.md      ← default locale
2026-10-14-export-excel.es.md   ← title and body in Spanish
```

## Validate

```bash
npx @shipdot/cli validate
```

```text
.shipdot/entries/a.md:3:1 - error: invalid date "2026-02-30": use a real date as YYYY-MM-DD
.shipdot/entries/b.fr.md:1:1 - error: locale "fr" is not declared in shipdot.config.json "locales" (en, es)
✖ Found 2 errors.
```

It exits with code 1 on errors, so you can run it in CI or a pre-commit hook.
