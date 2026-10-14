# ADR 0002: Sanitize HTML at build time, not in the widget

- Status: Accepted
- Date: 2026-10-14

## Context

Entry bodies are Markdown that becomes HTML in the user's app. A runtime sanitizer such as DOMPurify would cost more than the whole widget's size budget of 10 KB min+gzip.

## Decision

`@shipdot/core/compile`, which is used by `shipdot build` and the docs playground, renders Markdown with unified/remark. It sanitizes the result with rehype-sanitize using a strict allowlist: p, a (http, https, mailto), strong, em, code, pre, ul, ol, li, br, h3, h4, and img (with an https or relative `src`). Raw HTML in Markdown is dropped. The widget inserts the pre-sanitized HTML and escapes all plain-text fields, such as titles.

## Consequences

- Positive: the widget stays tiny and has no dependencies.
- Positive: there is one sanitization path for the CLI and the playground.
- Positive: the sanitizer is tested against XSS vectors.
- Negative: the widget trusts `shipdot.json`, so it must be served from a source the site owner controls.
- Negative: hand-edited `shipdot.json` files bypass sanitization.
