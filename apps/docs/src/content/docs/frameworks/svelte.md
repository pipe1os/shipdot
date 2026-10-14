---
title: Svelte
description: Use <ship-dot> in Svelte 5.
sidebar:
  order: 4
---

Svelte renders custom elements as-is.

```svelte title="src/routes/+layout.svelte"
<script>
  import { onMount } from 'svelte'

  // Load on the client. The import is also safe during SSR.
  onMount(() => {
    import('shipdot')
    const onRead = (event) => console.log('Read:', event.detail.ids)
    document.addEventListener('shipdot:read', onRead)
    return () => document.removeEventListener('shipdot:read', onRead)
  })
</script>

<header>
  <ship-dot src="/shipdot.json"></ship-dot>
</header>
```

For typed attributes in `.svelte` files, add `import type {} from 'shipdot/svelte'` in `src/app.d.ts`.

With SvelteKit, set `outDir` to `static` in `shipdot.config.json` (`shipdot init` does it for you when `static/` exists).
