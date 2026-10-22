'use client'

// The element registers itself in the browser; the import is safe during server rendering.
import 'shipdot'

export function WhatsNew() {
  return <ship-dot src={`${process.env.BASE_PATH}/shipdot.json`} first-visit="show-latest" />
}
