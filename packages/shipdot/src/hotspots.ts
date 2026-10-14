import type { Strings } from './strings'
import { LAYER_CSS, THEME_PROPS } from './styles'

export interface Spot {
  id: string
  /** CSS selector of the element to point at. */
  target: string
  type: string
  title: string
}

export interface HotspotOptions {
  /** The `<ship-dot>` element: the layer copies its theme and custom properties. */
  host: HTMLElement
  max: number
  strings: Strings
  locale: string
  /** Tooltip content for a spot (already-sanitized HTML). */
  content: (spot: Spot) => string
  fixUrls: (root: ParentNode) => void
  onClick: (id: string) => void
  onRead: (id: string) => void
  onError: (error: Error) => void
}

interface Live extends Spot {
  el: Element | null
  btn: HTMLButtonElement
  bad?: boolean
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))

/**
 * Pulsing dots over the real UI elements that unread entries point at. They live in their
 * own fixed layer (with its own shadow root) at the end of `<body>`, so app styles,
 * `overflow: hidden` and transformed ancestors never clip or shift them.
 */
export class Hotspots {
  readonly #o: HotspotOptions
  readonly #layer: HTMLDivElement = document.createElement('div')
  readonly #root: ShadowRoot = this.#layer.attachShadow({ mode: 'open' })
  readonly #spots: Live[]
  readonly #ro = new ResizeObserver(() => this.#schedule())
  readonly #mo = new MutationObserver(() => this.#schedule())
  #watching = false
  #raf = 0
  #tip: HTMLElement | undefined
  #tipSpot: Live | undefined
  readonly #onScroll = (): void => this.#schedule()
  readonly #onDown = (e: Event): void => {
    if (this.#tip && !e.composedPath().includes(this.#layer)) this.#closeTip(false)
  }

  constructor(spots: Spot[], options: HotspotOptions) {
    this.#o = options
    const layer = this.#layer
    layer.className = 'shipdot-layer'
    const style = getComputedStyle(options.host)
    layer.style.colorScheme = style.colorScheme
    for (const name of THEME_PROPS) {
      const value = style.getPropertyValue(`--shipdot-${name}`)
      if (value) layer.style.setProperty(`--shipdot-${name}`, value)
    }
    this.#root.innerHTML = `<style>${LAYER_CSS}</style>`
    this.#spots = spots.map((spot) => {
      const btn = document.createElement('button')
      const live: Live = { ...spot, el: null, btn }
      btn.type = 'button'
      btn.className = 'dot'
      btn.hidden = true
      btn.setAttribute('part', 'hotspot')
      btn.setAttribute('aria-expanded', 'false')
      btn.setAttribute(
        'aria-label',
        `${options.strings[spot.type as 'new'] ?? options.strings.new}: ${spot.title}`,
      )
      btn.onclick = () => {
        if (this.#tipSpot === live) this.#closeTip(true)
        else {
          options.onClick(spot.id)
          this.#openTip(live)
        }
      }
      this.#root.append(btn)
      return live
    })
    document.body.append(layer)
    addEventListener('scroll', this.#onScroll, { capture: true, passive: true })
    addEventListener('resize', this.#onScroll, { passive: true })
    document.addEventListener('pointerdown', this.#onDown, true)
    this.#ro.observe(document.documentElement)
    this.#layout()
  }

  destroy(): void {
    cancelAnimationFrame(this.#raf)
    this.#ro.disconnect()
    this.#mo.disconnect()
    removeEventListener('scroll', this.#onScroll, true)
    removeEventListener('resize', this.#onScroll)
    document.removeEventListener('pointerdown', this.#onDown, true)
    this.#layer.remove()
  }

  #schedule(): void {
    this.#raf ||= requestAnimationFrame(() => {
      this.#raf = 0
      this.#layout()
    })
  }

  #find(spot: Live): Element | null {
    try {
      return document.querySelector(spot.target)
    } catch {
      spot.bad = true
      this.#o.onError(new Error(`invalid hotspot target "${spot.target}"`))
      return null
    }
  }

  #layout(): void {
    let shown = 0
    let pending = false
    for (const spot of this.#spots) {
      if (spot.bad) continue
      if (!spot.el?.isConnected) {
        spot.el = this.#find(spot)
        if (spot.el) this.#ro.observe(spot.el)
      }
      const el = spot.el
      if (!el) {
        pending = !spot.bad || pending
        spot.btn.hidden = true
        continue
      }
      const r = el.getBoundingClientRect()
      const visible =
        shown < this.#o.max &&
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < innerHeight &&
        r.left < innerWidth &&
        el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false
      spot.btn.hidden = !visible
      if (visible) {
        shown++
        const x = clamp(r.right - 12, 0, innerWidth - 24)
        const y = clamp(r.top - 12, 0, innerHeight - 24)
        spot.btn.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`
      }
    }
    // Only watch the DOM while some target has not shown up yet (SPAs render late).
    if (pending !== this.#watching) {
      this.#watching = pending
      if (pending)
        this.#mo.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['id', 'class'],
        })
      else this.#mo.disconnect()
    }
    this.#placeTip()
  }

  #openTip(spot: Live): void {
    this.#closeTip(false)
    const o = this.#o
    const tip = document.createElement('div')
    tip.className = 'tip'
    tip.lang = o.locale
    tip.tabIndex = -1
    tip.setAttribute('part', 'tooltip')
    tip.setAttribute('role', 'dialog')
    tip.setAttribute('aria-labelledby', 'sd-tt')
    tip.innerHTML = `${o.content(spot)}<button type="button" class="ok" part="got-it">${o.strings.gotIt}</button>`
    o.fixUrls(tip)
    ;(tip.lastElementChild as HTMLButtonElement).onclick = () => {
      this.#closeTip(false)
      o.onRead(spot.id)
      ;(spot.el as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
    tip.onkeydown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        this.#closeTip(true)
      }
    }
    this.#root.append(tip)
    this.#tip = tip
    this.#tipSpot = spot
    spot.btn.setAttribute('aria-expanded', 'true')
    this.#placeTip()
    tip.focus()
  }

  #closeTip(focusDot: boolean): void {
    const spot = this.#tipSpot
    if (!spot) return
    this.#tip?.remove()
    this.#tip = this.#tipSpot = undefined
    spot.btn.setAttribute('aria-expanded', 'false')
    if (focusDot) spot.btn.focus()
  }

  #placeTip(): void {
    const tip = this.#tip
    const spot = this.#tipSpot
    if (!tip || !spot) return
    if (spot.btn.hidden) {
      this.#closeTip(false)
      return
    }
    const b = spot.btn.getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    let top = b.bottom + 4
    if (top + h > innerHeight - 8 && b.top - h - 4 > 8) top = b.top - h - 4
    const left = clamp(b.left - 16, 8, innerWidth - w - 8)
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`
  }
}
