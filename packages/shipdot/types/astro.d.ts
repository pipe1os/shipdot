// Types for using <ship-dot> in .astro files.
import type { ShipDotAttributes } from '../dist/shipdot.js'

declare global {
  namespace astroHTML.JSX {
    interface IntrinsicElements {
      'ship-dot': HTMLAttributes & ShipDotAttributes
    }
  }
}
