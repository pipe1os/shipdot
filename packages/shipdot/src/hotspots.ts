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
  /** Ancestors that clip `el`. */
  clips: Element[]
  btn: HTMLButtonElement
  bad?: boolean
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))

/**
 * Scroll containers and other `overflow` ancestors of `el`, so a target scrolled out of an
 * inner pane loses its dot. `<body>` and `<html>` are left out: their overflow usually
 * applies to the viewport, which is checked anyway.
 */
function clipsOf(el: Element): Element[] {
  const clips: Element[] = []
  let node = el
  // Ancestor overflow does not clip fixed elements.
  while (getComputedStyle(node).position !== 'fixed') {
    const parent = node.parentElement
    if (!parent || parent === document.body || parent === document.documentElement) break
    if (getComputedStyle(parent).overflow !== 'visible') clips.push(parent)
    node = parent
  }
  return clips
}

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
  readonly #mo = new MutationObserver(() => {
    this.#restyle = true
    this.#schedule()
  })
  #raf = 0
  /** A DOM change may have switched the app's theme (a class on `<html>`, a new stylesheet). */
  #restyle = true
  #tip: HTMLElement | undefined
  #tipSpot: Live | undefined
  readonly #onChange = (): void => this.#schedule()
  readonly #onDown = (e: Event): void => {
    if (this.#tip && !e.composedPath().includes(this.#layer)) this.#closeTip(false)
  }

  constructor(spots: Spot[], options: HotspotOptions) {
    this.#o = options
    const layer = this.#layer
    layer.className = 'shipdot-layer'
    this.#root.innerHTML = `<style>${LAYER_CSS}</style>`
    this.#spots = spots.map((spot) => {
      const btn = document.createElement('button')
      const live: Live = { ...spot, el: null, clips: [], btn }
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
    addEventListener('scroll', this.#onChange, { capture: true, passive: true })
    addEventListener('resize', this.#onChange, { passive: true })
    // ponytail: the dot snaps into place when a transition or animation ends, not during it.
    // Follow every frame between `transitionrun` and `transitionend` if that ever looks off.
    addEventListener('transitionend', this.#onChange, true)
    addEventListener('animationend', this.#onChange, true)
    document.addEventListener('pointerdown', this.#onDown, true)
    this.#ro.observe(document.documentElement)
    // Targets move without resizing when content is inserted above them, and render late in
    // SPAs. Every DOM change schedules one layout per frame at most.
    this.#mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
    this.#layout()
  }

  destroy(): void {
    cancelAnimationFrame(this.#raf)
    this.#ro.disconnect()
    this.#mo.disconnect()
    removeEventListener('scroll', this.#onChange, true)
    removeEventListener('resize', this.#onChange)
    removeEventListener('transitionend', this.#onChange, true)
    removeEventListener('animationend', this.#onChange, true)
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

  /** Copies the host's theme onto the layer, which lives outside `<ship-dot>`. */
  #theme(): void {
    const style = getComputedStyle(this.#o.host)
    const layer = this.#layer.style
    // Only on a change: writing `style` is itself a mutation, which would schedule another layout.
    for (const name of ['color-scheme', ...THEME_PROPS.map((p) => `--shipdot-${p}`)]) {
      const value = style.getPropertyValue(name)
      if (layer.getPropertyValue(name) !== value) layer.setProperty(name, value)
    }
  }

  #layout(): void {
    if (this.#restyle) {
      this.#restyle = false
      this.#theme()
    }
    let shown = 0
    for (const spot of this.#spots) {
      if (spot.bad) continue
      if (!spot.el?.isConnected) {
        spot.el = this.#find(spot)
        if (spot.el) {
          this.#ro.observe(spot.el)
          spot.clips = clipsOf(spot.el)
        }
      }
      const el = spot.el
      if (!el) {
        spot.btn.hidden = true
        continue
      }
      const r = el.getBoundingClientRect()
      // The part of the target that is not clipped by a scroll container.
      let { top, right, bottom, left } = r
      for (const clip of spot.clips) {
        const c = clip.getBoundingClientRect()
        top = Math.max(top, c.top)
        right = Math.min(right, c.right)
        bottom = Math.min(bottom, c.bottom)
        left = Math.max(left, c.left)
      }
      const visible =
        shown < this.#o.max &&
        r.width > 0 &&
        r.height > 0 &&
        bottom > Math.max(top, 0) &&
        right > Math.max(left, 0) &&
        top < innerHeight &&
        left < innerWidth &&
        el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false
      spot.btn.hidden = !visible
      if (visible) {
        shown++
        const x = clamp(right - 12, 0, innerWidth - 24)
        const y = clamp(top - 12, 0, innerHeight - 24)
        spot.btn.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`
      }
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
    // Images that finish loading grow the tooltip: place it again so it never covers the target.
    this.#ro.observe(tip)
    this.#tip = tip
    this.#tipSpot = spot
    spot.btn.setAttribute('aria-expanded', 'true')
    this.#placeTip()
    tip.focus()
  }

  #closeTip(focusDot: boolean): void {
    const spot = this.#tipSpot
    if (!spot) return
    this.#ro.unobserve(this.#tip as HTMLElement)
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
    // Below the target (above if there is no room), aligned with its nearest edge.
    const t = (spot.el as Element).getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    let top = t.bottom + 8
    if (top + h > innerHeight - 8 && t.top - h - 8 > 8) top = t.top - h - 8
    const left = clamp(
      t.left + t.width / 2 > innerWidth / 2 ? t.right - w : t.left,
      8,
      innerWidth - w - 8,
    )
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`
  }
}
