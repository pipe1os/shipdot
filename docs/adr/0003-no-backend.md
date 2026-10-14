# ADR 0003: No backend and no telemetry

- Status: Accepted
- Date: 2026-10-14

## Context

Hosted changelog widgets need a backend to store read state and analytics. That adds cost, privacy obligations and an outage point.

## Decision

The widget only fetches the static `shipdot.json` given in its `src` attribute. Read state is a bounded list of entry IDs in the end user's `localStorage` under `shipdot:<storage-key>`, and every access is wrapped in try/catch with a fallback to in-memory state. There are no analytics, no tracking and no third-party requests.

## Consequences

- Positive: it is free to host on any static host or CDN.
- Positive: there is nothing to operate.
- Positive: no personal data is collected.
- Positive: it works with strict CSPs.
- Negative: read state does not sync across devices or browsers.
- Negative: there is no built-in analytics, which is left to the roadmap as an opt-in feature.
