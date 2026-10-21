---
"shipdot": minor
---

The widget fetches `src` again when a tab comes back to the foreground 10 minutes or more after the last load, so tabs left open for days see new entries. Every fetch revalidates with the server (`cache: 'no-cache'`), so an unchanged feed costs a `304`.
