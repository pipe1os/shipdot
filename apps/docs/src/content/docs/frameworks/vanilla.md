---
title: Vanilla JS
description: Use <ship-dot> in any HTML page, from a CDN or npm.
sidebar:
  order: 1
---

From a CDN, no build step:

```html
<script type="module" src="https://unpkg.com/shipdot@0.1"></script>
<ship-dot src="/shipdot.json"></ship-dot>
```

Or with a bundler (`npm install shipdot`):

```js title="main.js"
import 'shipdot'

document.addEventListener('shipdot:read', (event) => console.log('Read:', event.detail.ids))
```

Run `shipdot build` before your bundler so `public/shipdot.json` exists:

```json title="package.json"
{ "scripts": { "build": "shipdot build && vite build" } }
```

Full example: [`examples/vanilla`](https://github.com/pipe1os/shipdot/tree/main/examples/vanilla).
