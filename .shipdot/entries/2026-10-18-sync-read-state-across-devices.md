---
date: 2026-10-18
type: new
title: Sync read state across devices
pr: 28
---
If your app has user accounts, entries a user read on one device can stay read on the others. Store the IDs from the `shipdot:read` event on your server and pass them back with `markRead(ids)`. shipdot still sends nothing: your app keeps the IDs.
