# ADR 0001: Git is the source of truth for entries

- Status: Accepted
- Date: 2026-10-14

## Context

SaaS changelog tools store announcements in their own database and charge per monthly active user. Release notes kept in those tools drift from what actually shipped.

## Decision

Every announcement is a Markdown file with YAML frontmatter in `.shipdot/entries/`, and these files are reviewed through pull requests, like code. `shipdot draft` proposes entries from merged pull requests and opens a pull request, and a human reviews the result before it is merged. Translations are sibling files, such as `entry.es.md`.

## Consequences

- Positive: history, review, blame and rollback come for free.
- Positive: no account or database is needed.
- Positive: it works offline.
- Positive: entries live next to the code that ships them.
- Negative: non-technical editors need GitHub access or help.
- Negative: editing requires a commit and a deploy.
