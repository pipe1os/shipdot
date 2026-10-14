// Types for using <ship-dot> in React 19+ JSX.
// Add `import type {} from 'shipdot/react'` once, or "shipdot/react" to tsconfig "types".
import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { ShipDot, ShipDotAttributes } from '../dist/shipdot.js'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ship-dot': DetailedHTMLProps<HTMLAttributes<ShipDot>, ShipDot> & ShipDotAttributes
    }
  }
}
