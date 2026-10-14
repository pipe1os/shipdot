# Security policy

## Supported versions

shipdot is pre-1.0. Security fixes land in the latest minor release of each package.

| Package | Supported |
| --- | --- |
| `shipdot`, `@shipdot/cli`, `@shipdot/core`: latest `0.x` minor | ✅ |
| `pipe1os/shipdot@v0` GitHub Action | ✅ |
| Older releases | ❌ Upgrade to the latest version |

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for security problems.**

Report privately through [GitHub Private Vulnerability Reporting](https://github.com/pipe1os/shipdot/security/advisories/new). Include:

- the affected package and version (or Action ref),
- what an attacker can do, and under which conditions,
- steps or a minimal repository that reproduces it.

## What to expect

- **Acknowledgement** within 3 business days.
- **First assessment** (confirmed or not, severity) within 7 days.
- **Fix** for confirmed high and critical issues within 30 days, released together with a GitHub Security Advisory. We coordinate the disclosure date with you and credit you in the advisory unless you prefer otherwise.

## Scope

In scope, for example:

- HTML or URLs that get past the build-time sanitizer (`@shipdot/core/compile`) and execute script in the widget.
- The widget injecting unescaped text from `shipdot.json` fields other than `html`.
- The GitHub Action or CLI leaking `GITHUB_TOKEN` or the LLM API key, or running pull request content in a shell.
- Pull request content that makes `shipdot draft` write files outside `.shipdot/entries/`.

Out of scope:

- A `shipdot.json` written by hand or by other tools: the widget trusts the feed by design (see [ADR 0002](docs/adr/0002-sanitize-html-at-build-time.md)), so serve it from a source you control.
- LLM output that is merely inaccurate. Drafts are always reviewed by a human in a pull request before they ship.
- Vulnerabilities in dependencies that are already public, unless shipdot is exploitable through them.

## How shipdot is built to be safe

- HTML is sanitized with a strict allowlist when entries are compiled, never in the browser.
- The widget has no runtime dependencies and makes no network requests besides its `src`.
- The Action talks to GitHub only through the REST API, treats pull request text as untrusted, masks secrets, and asks for the minimum permissions.

See [`AGENTS.md`](AGENTS.md) for the full list of architecture and security invariants.
