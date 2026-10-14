---
title: React
description: Use <ship-dot> in React 19+, with typed JSX.
sidebar:
  order: 2
---

React 19 supports custom elements natively: attributes, properties and refs just work.

```bash
npm install shipdot
npm install --save-dev @shipdot/cli
```

```tsx title="src/App.tsx"
import 'shipdot'
import type {} from 'shipdot/react' // types for <ship-dot> in JSX
import type { ShipDot } from 'shipdot'
import { useEffect, useRef } from 'react'

export function App() {
  const widget = useRef<ShipDot>(null)

  useEffect(() => {
    const el = widget.current
    const onRead = (event: Event) => console.log((event as CustomEvent<{ ids: string[] }>).detail.ids)
    el?.addEventListener('shipdot:read', onRead)
    return () => el?.removeEventListener('shipdot:read', onRead)
  }, [])

  return (
    <header>
      <ship-dot ref={widget} src="/shipdot.json" />
    </header>
  )
}
```

Instead of the `import type` line you can add `"types": ["shipdot/react"]` to `tsconfig.json`.

Full example: [`examples/react`](https://github.com/pipe1os/shipdot/tree/main/examples/react). For Next.js, see the [Next.js guide](/shipdot/frameworks/next/).
