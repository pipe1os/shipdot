import type { Feed, FeedEntry } from '@shipdot/core'
import { resolveLocale } from '@shipdot/core'
import { Hotspots, type Spot } from './hotspots'
import { readIds, writeIds } from './storage'
import { type Strings, stringsFor } from './strings'
import { HOST_CSS } from './styles'

export type { Feed, FeedEntry } from '@shipdot/core'

export type ShipDotMode = 'popover' | 'drawer' | 'modal'

/** Attributes of `<ship-dot>`, for framework typings. */
export interface ShipDotAttributes {
  /** URL of `shipdot.json`. */
  src: string
  mode?: ShipDotMode
  /** Locale to show. Defaults to `navigator.languages`, then the feed's default locale. */
  locale?: string
  theme?: 'light' | 'dark' | 'auto'
  /** `off` disables hotspots. */
  hotspots?: 'on' | 'off'
  'max-hotspots'?: number | string
  /** `mark-read` (default): a first visit starts with everything read. `show-latest`: the newest entry stays unread. */
  'first-visit'?: 'mark-read' | 'show-latest'
  /** Read state is stored in localStorage under `shipdot:<storage-key>`. Default: `default`. */
  'storage-key'?: string
}

/** Events dispatched by `<ship-dot>`. All bubble and cross shadow roots. */
export interface ShipDotEventMap {
  'shipdot:ready': CustomEvent<{ entries: number; unread: number; locale: string }>
  'shipdot:open': CustomEvent<{ mode: ShipDotMode }>
  'shipdot:close': CustomEvent<{ mode: ShipDotMode }>
  'shipdot:read': CustomEvent<{ ids: string[] }>
  'shipdot:hotspot-click': CustomEvent<{ id: string }>
  'shipdot:error': CustomEvent<{ error: Error }>
}

const esc = (text: string): string =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const BELL =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>'

/** The widget that draws hotspots for each storage key, so two widgets on a page don't both. */
const owners = new Map<string, ShipDot>()

// SSR-safe: importing the module on a server must not throw.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

/**
 * `<ship-dot src="/shipdot.json">`: a "What's new" button with an unread count, a feed
 * panel, and hotspots on the UI elements that new entries point at.
 */
export class ShipDot extends Base {
  static observedAttributes: string[] = [
    'src',
    'locale',
    'theme',
    'hotspots',
    'max-hotspots',
    'storage-key',
  ]

  #root: ShadowRoot | undefined
  #btn: HTMLButtonElement | undefined
  #panel: HTMLElement | undefined
  #feed: Feed | undefined
  #url: URL | undefined
  #read = new Set<string>()
  #initialized = false
  #connected = false
  #isOpen = false
  #locale = 'en'
  #strings: Strings = stringsFor('en')
  #spots: Hotspots | undefined
  /** What the current hotspot layer was built from, to skip rebuilding an identical one. */
  #spotsKey = ''
  #run = 0
  #channel: BroadcastChannel | undefined
  readonly #onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.#closed(true)
  }
  readonly #onDown = (e: Event): void => {
    if (!e.composedPath().includes(this)) this.#closed(false)
  }
  readonly #place = (): void => {
    const panel = this.#panel
    if (panel?.localName !== 'div') return
    const r = this.getBoundingClientRect()
    const width = panel.offsetWidth
    // Below the trigger, or above it when it does not fit and there is more room there.
    const below = innerHeight - r.bottom - 24
    const above = r.top - 24
    const up = panel.scrollHeight > below && above > below
    panel.style.maxHeight = `${Math.max(0, Math.min(560, up ? above : below))}px`
    const top = up ? r.top - 8 - panel.offsetHeight : r.bottom + 8
    panel.style.left = `${Math.round(Math.max(8, Math.min(r.right - width, innerWidth - width - 8)))}px`
    panel.style.top = `${Math.round(top)}px`
  }

  connectedCallback(): void {
    this.#connected = true
    if (!this.#root) {
      const root = this.attachShadow({ mode: 'open' })
      root.innerHTML = `<style>${HOST_CSS}</style><slot><button type="button" class="trigger" part="trigger" aria-haspopup="dialog" aria-expanded="false">${BELL}<span class="badge" part="badge" hidden></span></button></slot>`
      this.#root = root
      this.#btn = root.querySelector('button') as HTMLButtonElement
      ;(root.querySelector('slot') as HTMLSlotElement).onclick = () =>
        this.#isOpen ? this.close() : this.open()
    }
    this.#listen()
    if (this.#feed) this.#update()
    else void this.refresh()
  }

  disconnectedCallback(): void {
    this.#connected = false
    this.close()
    this.#spots?.destroy()
    this.#spots = undefined
    if (owners.get(this.#key()) === this) {
      owners.delete(this.#key())
      // Another widget on the page with this key takes the hotspots over.
      this.#channel?.postMessage([])
    }
    this.#channel?.close()
    this.#channel = undefined
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (!this.#connected || !this.#root || old === value) return
    if (name === 'src') void this.refresh()
    else if (name === 'storage-key') {
      this.#initialized = false
      this.#read = new Set()
      this.#listen()
      void this.refresh()
    } else this.#update()
  }

  /** Unread entries, newest first. */
  get unread(): FeedEntry[] {
    return this.#feed?.entries.filter((e) => !this.#read.has(e.id)) ?? []
  }

  get entries(): FeedEntry[] {
    return this.#feed?.entries ?? []
  }

  /** Fetches `src` again and re-renders. */
  async refresh(): Promise<void> {
    const src = this.getAttribute('src')
    if (!src) return
    const run = ++this.#run
    try {
      const url = new URL(src, document.baseURI)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`could not load ${url} (${res.status})`)
      const feed = (await res.json()) as Feed
      // A newer refresh() started meanwhile (for example `src` changed): its feed wins.
      if (run !== this.#run) return
      if (feed?.version !== 1 || !Array.isArray(feed.entries))
        throw new Error(`${url} is not a shipdot.json v1 feed`)
      feed.entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      this.#feed = feed
      this.#url = url
      // Entry HTML may have changed under the same ID.
      this.#spotsKey = ''
      // Merge instead of replacing: `markRead()` may have run before the feed loaded.
      let ids = readIds(this.#key())
      if (!ids && !this.#initialized) {
        // First visit: existing entries count as read unless first-visit="show-latest".
        ids = feed.entries.map((e) => e.id)
        if (this.getAttribute('first-visit') === 'show-latest') ids.shift()
      }
      for (const id of ids ?? []) this.#read.add(id)
      this.#save()
      this.#initialized = true
      this.#update()
      this.#emit('ready', {
        entries: feed.entries.length,
        unread: this.unread.length,
        locale: this.#locale,
      })
    } catch (error) {
      if (run !== this.#run) return
      this.#emit('error', { error: error as Error })
      console.warn('[shipdot]', error)
    }
  }

  open(): void {
    const feed = this.#feed
    const root = this.#root
    if (this.#isOpen || !feed || !root) return
    const mode = this.#mode()
    let panel = this.#panel
    if (panel?.dataset.mode !== mode) {
      panel?.remove()
      const el = document.createElement(mode === 'popover' ? 'div' : 'dialog')
      el.dataset.mode = mode
      el.className = `panel ${mode}`
      el.tabIndex = -1
      el.setAttribute('part', 'panel')
      el.setAttribute('aria-labelledby', 'sd-t')
      if (mode === 'popover') {
        el.setAttribute('role', 'dialog')
        el.popover = 'manual'
      }
      el.addEventListener('close', () => this.#closed(true))
      // A click on the dialog itself (not its content) is a click on the backdrop.
      el.addEventListener('click', (e) => e.target === el && this.close())
      // Keep Tab inside drawer/modal instead of letting it escape to the browser UI.
      if (mode !== 'popover')
        el.onkeydown = (e) => {
          if (e.key !== 'Tab') return
          const items = [...el.querySelectorAll<HTMLElement>('a[href],button')]
          const active = root.activeElement
          const edge = e.shiftKey ? active === items[0] || active === el : active === items.at(-1)
          if (edge) {
            e.preventDefault()
            items.at(e.shiftKey ? -1 : 0)?.focus()
          }
        }
      root.append(el)
      this.#panel = panel = el
    }
    const s = this.#strings
    const unread = this.unread
    const items = feed.entries
      .map((e) => {
        const isUnread = unread.includes(e)
        return `<li class="e${isUnread ? ' u' : ''}" part="entry"><div class="m">${this.#tag(e)}<time datetime="${esc(e.date)}">${this.#date(e.date)}</time>${isUnread ? `<span class="sr">${s.unreadOne}</span>` : ''}</div><h3 class="h" part="entry-title">${esc(this.#text(e).title)}</h3>${this.#details(e)}</li>`
      })
      .join('')
    panel.lang = this.#locale
    panel.innerHTML = `<header part="header"><h2 id="sd-t">${s.title}</h2><button type="button" class="x" part="close" aria-label="${s.close}">×</button></header>${items ? `<ul class="l" part="list">${items}</ul>` : `<p class="empty">${s.empty}</p>`}`
    this.#fixUrls(panel)
    ;(panel.querySelector('.x') as HTMLButtonElement).onclick = () => this.close()
    this.#isOpen = true
    if (mode === 'popover') {
      panel.showPopover()
      this.#place()
      document.addEventListener('keydown', this.#onKey)
      document.addEventListener('pointerdown', this.#onDown, true)
      addEventListener('resize', this.#place)
      addEventListener('scroll', this.#place, { capture: true, passive: true })
    } else (panel as HTMLDialogElement).showModal()
    panel.focus()
    const trigger = this.#trigger()
    trigger?.setAttribute('aria-haspopup', 'dialog')
    trigger?.setAttribute('aria-expanded', 'true')
    this.#emit('open', { mode })
    this.markRead(unread.map((e) => e.id))
  }

  close(): void {
    const panel = this.#panel
    if (!this.#isOpen || !panel) return
    if (panel instanceof HTMLDialogElement) panel.close()
    this.#closed(true)
  }

  /** Marks every entry as read: clears the badge and removes hotspots. */
  markAllRead(): void {
    this.markRead(this.entries.map((e) => e.id))
  }

  /**
   * Marks the entries with these IDs as read, for example IDs your app synced from
   * another device. Can be called before the feed loads.
   */
  markRead(ids: string[]): void {
    const fresh = ids.filter((id) => !this.#read.has(id))
    if (!fresh.length) return
    for (const id of fresh) this.#read.add(id)
    this.#save()
    this.#channel?.postMessage(fresh)
    this.#emit('read', { ids: fresh })
    this.#update()
  }

  /** Marks the newest entry as unread again, bringing back its badge and hotspot. */
  replayLatest(): void {
    const latest = this.entries[0]
    if (!latest) return
    this.#read.delete(latest.id)
    this.#save()
    this.#update()
  }

  #closed(focusTrigger: boolean): void {
    if (!this.#isOpen) return
    const panel = this.#panel as HTMLElement
    if (panel.localName === 'div') panel.hidePopover()
    this.#isOpen = false
    document.removeEventListener('keydown', this.#onKey)
    document.removeEventListener('pointerdown', this.#onDown, true)
    removeEventListener('resize', this.#place)
    removeEventListener('scroll', this.#place, true)
    const trigger = this.#trigger()
    trigger?.setAttribute('aria-expanded', 'false')
    if (focusTrigger) trigger?.focus()
    this.#emit('close', { mode: panel.dataset.mode as ShipDotMode })
  }

  /** The slotted custom trigger, or the built-in bell. */
  #trigger(): HTMLElement | undefined {
    const slot = this.#root?.querySelector('slot')
    return (slot?.assignedElements()[0] as HTMLElement | undefined) ?? this.#btn
  }

  #update(): void {
    const feed = this.#feed
    if (!feed || !this.#btn) return
    const available = [feed.defaultLocale]
    for (const e of feed.entries) available.push(...Object.keys(e.i18n ?? {}))
    const requested = this.getAttribute('locale')
    this.#locale = resolveLocale(
      requested ? [requested] : (navigator.languages ?? []),
      available,
      feed.defaultLocale,
    )
    const s = stringsFor(this.#locale)
    this.#strings = s
    const count = this.unread.length
    const badge = this.#btn.lastElementChild as HTMLElement
    badge.hidden = !count
    badge.textContent = count > 9 ? '9+' : String(count)
    this.#btn.setAttribute(
      'aria-label',
      count ? `${s.title} (${s.unread.replace('{n}', String(count))})` : s.title,
    )
    this.dataset.unread = String(count)

    const spots: Spot[] =
      this.getAttribute('hotspots') === 'off' || !this.#owns()
        ? []
        : this.unread
            .filter((e) => e.target)
            .map((e) => ({
              id: e.id,
              target: e.target as string,
              type: e.type,
              title: this.#text(e).title,
            }))
    const max = Number.parseInt(this.getAttribute('max-hotspots') ?? '', 10)
    // Rebuilding restarts every pulse and closes an open tooltip, so only do it on a change.
    const key = JSON.stringify([spots, this.#locale, this.getAttribute('theme'), max])
    if (this.#spots && key === this.#spotsKey) return
    this.#spots?.destroy()
    this.#spots = undefined
    this.#spotsKey = key
    if (spots.length && this.#connected) {
      this.#spots = new Hotspots(spots, {
        host: this,
        max: Number.isNaN(max) ? 3 : max,
        strings: s,
        locale: this.#locale,
        content: (spot) => {
          const e = feed.entries.find((x) => x.id === spot.id) as FeedEntry
          return `${this.#tag(e)}<p class="tt" id="sd-tt">${esc(spot.title)}</p>${this.#details(e)}`
        },
        fixUrls: (el) => this.#fixUrls(el),
        onClick: (id) => this.#emit('hotspot-click', { id }),
        onRead: (id) => this.markRead([id]),
        onError: (error) => this.#emit('error', { error }),
      })
    }
  }

  /**
   * Other tabs and other widgets on this page with the same storage key hear about reads,
   * also when `localStorage` is unavailable.
   */
  #listen(): void {
    this.#channel?.close()
    this.#channel = undefined
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(this.#key())
    // No `shipdot:read` here: the widget where the entries were read already reported them.
    channel.onmessage = (e: MessageEvent) => {
      if (!Array.isArray(e.data)) return
      for (const id of e.data) if (typeof id === 'string') this.#read.add(id)
      this.#save()
      this.#update()
    }
    this.#channel = channel
  }

  /** Claims the hotspots for this storage key when no connected widget has them. */
  #owns(): boolean {
    const key = this.#key()
    const owner = owners.get(key)
    const held = owner?.isConnected && owner.#key() === key
    if (this.#connected && !held) owners.set(key, this)
    return owners.get(key) === this
  }

  #text(e: FeedEntry): { title: string; html: string } {
    return e.i18n?.[this.#locale] ?? e
  }

  #tag(e: FeedEntry): string {
    const type = e.type in this.#strings ? e.type : 'new'
    return `<span class="tag ${type}" part="tag">${this.#strings[type]}</span>`
  }

  #details(e: FeedEntry): string {
    const image = e.image
      ? `<img class="img" part="image" src="${esc(e.image)}" alt="" loading="lazy">`
      : ''
    const link =
      e.link && /^https?:\/\//i.test(e.link)
        ? `<a class="more" part="link" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">${this.#strings.more}</a>`
        : ''
    // `html` was sanitized by `shipdot build` (allowlist); it is never built from user input here.
    return `${image}<div class="b" part="body">${this.#text(e).html}</div>${link}`
  }

  #date(date: string): string {
    try {
      return new Intl.DateTimeFormat(this.#locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(`${date}T00:00:00Z`),
      )
    } catch {
      return esc(date)
    }
  }

  /** Relative image URLs in the feed are relative to `shipdot.json`, not to the page. */
  #fixUrls(root: ParentNode): void {
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src')
      if (src && this.#url) img.src = new URL(src, this.#url).href
    }
  }

  #mode(): ShipDotMode {
    const mode = this.getAttribute('mode')
    return mode === 'drawer' || mode === 'modal' ? mode : 'popover'
  }

  #key(): string {
    return `shipdot:${this.getAttribute('storage-key') || 'default'}`
  }

  #save(): void {
    // Before the feed loads every ID would be filtered out, wiping the stored state.
    if (!this.#feed) return
    const ids = new Set(this.entries.map((e) => e.id))
    writeIds(
      this.#key(),
      [...this.#read].filter((id) => ids.has(id)),
    )
  }

  #emit<K extends keyof ShipDotEventMap>(
    name: K extends `shipdot:${infer N}` ? N : never,
    detail: ShipDotEventMap[K]['detail'],
  ): void {
    this.dispatchEvent(
      new CustomEvent(`shipdot:${name}`, { detail, bubbles: true, composed: true }),
    )
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ship-dot': ShipDot
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('ship-dot'))
  customElements.define('ship-dot', ShipDot)
