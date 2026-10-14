// Types for using <ship-dot> in Vue templates.
// Also tell the compiler it is a custom element: `isCustomElement: (tag) => tag === 'ship-dot'`.
import type { DefineComponent } from 'vue'
import type { ShipDotAttributes } from '../dist/shipdot.js'

declare module 'vue' {
  interface GlobalComponents {
    'ship-dot': DefineComponent<ShipDotAttributes>
  }
}
