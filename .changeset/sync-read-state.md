---
"shipdot": minor
---

Read state syncs across tabs and widgets. Reading entries in one tab clears the badge and hotspots in the others, and widgets on the same page with the same `storage-key` share read state and draw each hotspot once. Uses a `BroadcastChannel` named after the storage key, so it also works without `localStorage`. `shipdot:read` fires only in the widget where the entries were read.
