---
title: Astro
description: Use <ship-dot> in Astro pages.
sidebar:
  order: 5
---

```astro title="src/layouts/Layout.astro"
<header>
  <ship-dot src="/shipdot.json"></ship-dot>
</header>

<script>
  import 'shipdot'
</script>
```

Astro bundles the script and loads it on the client. If your site has a `base`, include it in `src`: `src={`${import.meta.env.BASE_URL}shipdot.json`}`.

Run `shipdot build` before `astro build` so `public/shipdot.json` is copied into the site. For typed attributes, add `import type {} from 'shipdot/astro'` to `src/env.d.ts`.

This documentation site is built with Astro and shows shipdot's own updates in the header.

Full example: [`examples/astro`](https://github.com/pipe1os/shipdot/tree/main/examples/astro).
