---
"shipdot": patch
---

`markRead(ids)` marks entries as read by ID, so an app with user accounts can sync read state across devices: store the IDs from `shipdot:read` on your server and pass them back. It can be called before the feed loads.
