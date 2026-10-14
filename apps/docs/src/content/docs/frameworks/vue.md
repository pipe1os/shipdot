---
title: Vue
description: Use <ship-dot> in Vue 3 templates.
sidebar:
  order: 3
---

Tell the Vue compiler that `ship-dot` is a custom element, so it doesn't try to resolve it as a component:

```js title="vite.config.js"
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'ship-dot' } } })],
})
```

```vue title="src/App.vue"
<script setup>
import 'shipdot'

function onRead(event) {
  console.log('Read:', event.detail.ids)
}
</script>

<template>
  <ship-dot src="/shipdot.json" @shipdot:read="onRead"></ship-dot>
</template>
```

With TypeScript, add `import type {} from 'shipdot/vue'` once (or `"types": ["shipdot/vue"]` in `tsconfig.json`) for template type checking.

Full example: [`examples/vue`](https://github.com/pipe1os/shipdot/tree/main/examples/vue).
