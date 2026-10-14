import 'shipdot'
import { useEffect, useRef } from 'react'
import type { ShipDot } from 'shipdot'
import type {} from 'shipdot/react'

export function App() {
  const widget = useRef<ShipDot>(null)

  useEffect(() => {
    const element = widget.current
    if (!element) return
    const onRead = (event: Event) => {
      console.log('Read:', (event as CustomEvent<{ ids: string[] }>).detail.ids)
    }
    element.addEventListener('shipdot:read', onRead)
    return () => element.removeEventListener('shipdot:read', onRead)
  }, [])

  return (
    <>
      <header>
        <strong>Acme</strong>
        <ship-dot ref={widget} src="/shipdot.json" first-visit="show-latest" />
      </header>
      <main>
        <h1>Reports</h1>
        <button type="button" id="btn-export">
          Export CSV
        </button>
      </main>
    </>
  )
}
