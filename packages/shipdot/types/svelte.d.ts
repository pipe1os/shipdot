// Types for using <ship-dot> in Svelte 5 templates.
import type { HTMLAttributes } from 'svelte/elements'
import type { ShipDot, ShipDotAttributes } from '../dist/shipdot.js'

declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    'ship-dot': HTMLAttributes<ShipDot> & ShipDotAttributes
  }
}
