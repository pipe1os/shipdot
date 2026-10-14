---
title: Feed format (shipdot.json v1)
description: The versioned JSON contract between the CLI and the widget.
---

`shipdot build` writes `shipdot.json`; the widget reads it. The format is versioned and published as a JSON Schema at [`https://unpkg.com/@shipdot/core/schema/v1.json`](https://unpkg.com/@shipdot/core/schema/v1.json).

```json
{
  "$schema": "https://unpkg.com/@shipdot/core/schema/v1.json",
  "version": 1,
  "generatedAt": "2026-10-14T21:00:00Z",
  "defaultLocale": "en",
  "entries": [
    {
      "id": "2026-10-14-export-excel",
      "date": "2026-10-14",
      "type": "new",
      "title": "Export to Excel",
      "html": "<p>You can now export any report to Excel with one click.</p>",
      "target": "#btn-export",
      "link": "https://example.com/docs/export",
      "image": "shipdot-assets/export.png",
      "i18n": {
        "es": { "title": "Exportar a Excel", "html": "<p>Ahora puedes exportar…</p>" }
      }
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `version` | `1` | Format version. |
| `generatedAt` | ISO date-time | When the file was built. |
| `defaultLocale` | locale tag | Language of `title` and `html`. |
| `entries[]` | array | Newest first. |
| `entries[].id` | string | Stable ID, used for read state. |
| `entries[].date` | `YYYY-MM-DD` | Release date. |
| `entries[].type` | `new` \| `improved` \| `fixed` | Kind of change. |
| `entries[].title` | string | Plain text. The widget escapes it. |
| `entries[].html` | string | Sanitized at build time with an allowlist. |
| `entries[].target` | string, optional | CSS selector for a hotspot. |
| `entries[].link` | http(s) URL, optional | "Learn more" link. |
| `entries[].image` | string, optional | https URL or a path relative to `shipdot.json`. |
| `entries[].i18n` | object, optional | Locale → `{ title, html }`. |

## Trust model

The widget inserts `html` as-is, because it was sanitized by `shipdot build`. Serve `shipdot.json` from a source you control, and don't hand-edit HTML into it. Plain-text fields are always escaped. Links that aren't http(s) are ignored.

## Versioning

- Adding optional fields is **not** a breaking change; the widget ignores fields it doesn't know.
- Any breaking change gets `"version": 2`, a new schema file (`schema/v2.json`), and a widget that reads both versions during a deprecation window.
- The widget refuses unknown versions and dispatches `shipdot:error`.

`validateFeed()` from `@shipdot/core` checks a parsed feed in JavaScript and returns human-readable problems.
