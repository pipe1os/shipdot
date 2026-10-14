---
title: Next.js
description: Use <ship-dot> in the Next.js App Router.
sidebar:
  order: 6
---

Custom elements run in the browser, so render the widget from a client component:

```jsx title="app/whats-new.jsx"
'use client'
import 'shipdot'

export function WhatsNew() {
  return <ship-dot src="/shipdot.json" />
}
```

```jsx title="app/layout.jsx"
import { WhatsNew } from './whats-new'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <WhatsNew />
        </header>
        {children}
      </body>
    </html>
  )
}
```

The `shipdot` module is safe to import during server rendering: it only registers the element in the browser.

Run `shipdot build` before `next build` so `public/shipdot.json` exists. With TypeScript, add `import type {} from 'shipdot/react'` once for JSX types.

Full example: [`examples/next`](https://github.com/pipe1os/shipdot/tree/main/examples/next).
