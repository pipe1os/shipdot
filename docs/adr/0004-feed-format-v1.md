# ADR 0004: Versioned feed format (shipdot.json v1)

- Status: Accepted
- Date: 2026-10-14

## Context

The CLI and the widget are released independently, and a site may cache an old widget or an old feed.

## Decision

`shipdot.json` has `"version": 1` and a published JSON Schema at `https://unpkg.com/@shipdot/core/schema/v1.json`. Its top-level fields are `version`, `generatedAt`, `defaultLocale` and `entries[]`. Each entry has `id`, `date`, `type` (new, improved or fixed), `title` and `html`, plus the optional fields `target`, `link`, `image` and `i18n` (a map from locale to title and html). Adding optional fields is not a breaking change. Any breaking change requires `version: 2`, a new schema file, and a widget that supports both versions for a deprecation window.

## Consequences

- Positive: there is a clear contract for third-party tools and validators.
- Positive: upgrades are safe.
- Negative: the schema must be maintained in two places, the TypeScript validator and the JSON Schema, and kept in sync by tests.
