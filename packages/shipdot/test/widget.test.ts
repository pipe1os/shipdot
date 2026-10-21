import type { Feed } from '@shipdot/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShipDot, ShipDotEventMap } from '../src/index'
import { MAX_IDS, readIds, writeIds } from '../src/storage'
import { stringsFor } from '../src/strings'

const feed: Feed = {
  version: 1,
  generatedAt: '2026-10-14T21:00:00Z',
  defaultLocale: 'en',
  entries: [
    {
      id: 'export',
      date: '2026-10-14',
      type: 'new',
      title: 'Export to Excel',
      html: '<p>One click.</p><img src="shipdot-assets/a.png" alt="">',
      target: '#btn-export',
      link: 'https://example.com/docs',
      i18n: { es: { title: 'Exportar a Excel', html: '<p>Un clic.</p>' } },
    },
    { id: 'search', date: '2026-09-01', type: 'improved', title: 'Faster <search>', html: '' },
    {
      id: 'bug',
      date: '2026-08-01',
      type: 'fixed',
      title: 'Fixed a bug',
      html: '',
      link: 'javascript:alert(1)',
    },
  ],
}

function mockFeed(body: unknown = feed, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function mount(
  attrs: Record<string, string> = {},
  setup?: (el: ShipDot) => void,
): Promise<ShipDot> {
  const el = document.createElement('ship-dot')
  for (const [name, value] of Object.entries({ src: '/data/shipdot.json', ...attrs }))
    el.setAttribute(name, value)
  setup?.(el)
  const ready = new Promise((resolve) => {
    el.addEventListener('shipdot:ready', resolve, { once: true })
    el.addEventListener('shipdot:error', resolve, { once: true })
  })
  document.body.append(el)
  await ready
  return el
}

const trigger = (el: ShipDot) => el.shadowRoot?.querySelector('.trigger') as HTMLButtonElement
const badge = (el: ShipDot) => el.shadowRoot?.querySelector('.badge') as HTMLElement

// happy-dom has no Popover API; real browsers are covered by the Playwright tests.
HTMLElement.prototype.showPopover ??= function (this: HTMLElement) {
  this.dataset.popoverOpen = ''
}
HTMLElement.prototype.hidePopover ??= function (this: HTMLElement) {
  delete this.dataset.popoverOpen
}

beforeEach(async () => {
  await import('../src/index')
  localStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('storage', () => {
  it('round-trips ids and keeps only the most recent ones', () => {
    writeIds('k', ['a', 'b'])
    expect(readIds('k')).toEqual(['a', 'b'])
    writeIds(
      'k',
      Array.from({ length: MAX_IDS + 10 }, (_, i) => String(i)),
    )
    expect(readIds('k')).toHaveLength(MAX_IDS)
    expect(readIds('k')?.[0]).toBe('10')
  })

  it('returns undefined for first visits, garbage and unavailable storage', () => {
    expect(readIds('missing')).toBeUndefined()
    localStorage.setItem('bad', '{oops')
    expect(readIds('bad')).toBeUndefined()
    localStorage.setItem('obj', '{"a":1}')
    expect(readIds('obj')).toBeUndefined()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(readIds('k')).toBeUndefined()
    expect(() => writeIds('k', ['a'])).not.toThrow()
  })
})

describe('strings', () => {
  it('matches the base language and falls back to English', () => {
    expect(stringsFor('pt-BR').title).toBe('Novidades')
    expect(stringsFor('ES').title).toBe('Novedades')
    expect(stringsFor('fr').title).toBe("What's new")
  })
})

describe('<ship-dot>', () => {
  it('fetches src relative to the page and starts with everything read on a first visit', async () => {
    const fetchMock = mockFeed()
    const el = await mount()
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toMatch(/\/data\/shipdot\.json$/)
    expect(el.unread).toEqual([])
    expect(badge(el).hidden).toBe(true)
    expect(trigger(el).getAttribute('aria-label')).toBe("What's new")
    expect(readIds('shipdot:default')).toEqual(['export', 'search', 'bug'])
  })

  it('keeps the latest entry unread with first-visit="show-latest"', async () => {
    mockFeed()
    const el = await mount({ 'first-visit': 'show-latest' })
    expect(el.unread.map((e) => e.id)).toEqual(['export'])
    expect(badge(el).hidden).toBe(false)
    expect(badge(el).textContent).toBe('1')
    expect(trigger(el).getAttribute('aria-label')).toBe("What's new (1 unread)")
    expect(el.dataset.unread).toBe('1')
  })

  it('counts entries missing from stored read state as unread', async () => {
    writeIds('shipdot:app', ['bug'])
    mockFeed()
    const el = await mount({ 'storage-key': 'app' })
    expect(el.unread.map((e) => e.id)).toEqual(['export', 'search'])
    expect(badge(el).textContent).toBe('2')
  })

  it('works without localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    mockFeed()
    const el = await mount({ 'first-visit': 'show-latest' })
    expect(el.unread).toHaveLength(1)
    el.markAllRead()
    expect(el.unread).toHaveLength(0)
    await el.refresh()
    expect(el.unread).toHaveLength(0)
  })

  it('opens, renders entries safely, marks them read and closes', async () => {
    writeIds('shipdot:default', [])
    mockFeed()
    const el = await mount({ hotspots: 'off' })
    const events: string[] = []
    for (const name of ['shipdot:open', 'shipdot:read', 'shipdot:close'] as const)
      el.addEventListener(name, (e) => {
        const detail = (e as ShipDotEventMap[typeof name]).detail
        events.push(`${name} ${JSON.stringify(detail)}`)
      })
    el.open()
    const panel = el.shadowRoot?.querySelector('[part="panel"]') as HTMLElement
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.querySelectorAll('li.e.u')).toHaveLength(3)
    expect(panel.querySelector('h2')?.textContent).toBe("What's new")
    // Titles are escaped, sanitized HTML is kept, unsafe links are dropped.
    expect(panel.innerHTML).toContain('Faster &lt;search&gt;')
    expect(panel.innerHTML).toContain('<p>One click.</p>')
    expect(panel.querySelectorAll('a.more')).toHaveLength(1)
    expect(panel.innerHTML).not.toContain('javascript:')
    // Relative images resolve against the feed URL.
    expect(panel.querySelector('img')?.getAttribute('src')).toMatch(
      /\/data\/shipdot-assets\/a\.png$/,
    )
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true')
    expect(el.unread).toEqual([])
    expect(badge(el).hidden).toBe(true)
    el.close()
    expect(trigger(el).getAttribute('aria-expanded')).toBe('false')
    expect(events).toEqual([
      'shipdot:open {"mode":"popover"}',
      'shipdot:read {"ids":["export","search","bug"]}',
      'shipdot:close {"mode":"popover"}',
    ])
  })

  it('uses <dialog> for drawer and modal modes', async () => {
    mockFeed()
    const el = await mount({ mode: 'drawer' })
    el.open()
    const panel = el.shadowRoot?.querySelector('[part="panel"]')
    expect(panel?.localName).toBe('dialog')
    expect(panel?.classList.contains('drawer')).toBe(true)
    el.close()
    el.setAttribute('mode', 'modal')
    el.open()
    expect(el.shadowRoot?.querySelectorAll('[part="panel"]')).toHaveLength(1)
    expect(el.shadowRoot?.querySelector('dialog')?.classList.contains('modal')).toBe(true)
  })

  it('shows an empty state', async () => {
    mockFeed({ ...feed, entries: [] })
    const el = await mount()
    el.open()
    expect(el.shadowRoot?.querySelector('.empty')?.textContent).toBe('Nothing new yet.')
  })

  it('translates entries and UI with the locale attribute, with per-entry fallback', async () => {
    writeIds('shipdot:default', ['bug'])
    mockFeed()
    const el = await mount({ locale: 'es-CL', hotspots: 'off' })
    expect(trigger(el).getAttribute('aria-label')).toBe('Novedades (2 sin leer)')
    el.open()
    const panel = el.shadowRoot?.querySelector('[part="panel"]') as HTMLElement
    expect(panel.lang).toBe('es')
    const titles = [...panel.querySelectorAll('.h')].map((h) => h.textContent)
    expect(titles).toEqual(['Exportar a Excel', 'Faster <search>', 'Fixed a bug'])
    expect(panel.querySelector('.tag')?.textContent).toBe('Nuevo')
    expect(panel.querySelector('a.more')?.textContent).toBe('Más información')
  })

  it('falls back to the default locale for unknown languages', async () => {
    mockFeed()
    const el = await mount({ locale: 'de' })
    el.open()
    expect(el.shadowRoot?.querySelector('.h')?.textContent).toBe('Export to Excel')
  })

  it('replays the latest entry', async () => {
    mockFeed()
    const el = await mount()
    el.replayLatest()
    expect(el.unread.map((e) => e.id)).toEqual(['export'])
    expect(readIds('shipdot:default')).toEqual(['search', 'bug'])
  })

  it('marks entries read by ID, also before the feed loads', async () => {
    writeIds('shipdot:default', [])
    mockFeed()
    const events: string[][] = []
    const el = await mount({ hotspots: 'off' }, (el) => {
      el.addEventListener('shipdot:read', (e) =>
        events.push((e as ShipDotEventMap['shipdot:read']).detail.ids),
      )
      el.markRead(['search'])
    })
    expect(el.unread.map((e) => e.id)).toEqual(['export', 'bug'])
    expect(readIds('shipdot:default')).toEqual(['search'])
    el.markRead(['search', 'bug'])
    expect(el.unread.map((e) => e.id)).toEqual(['export'])
    expect(readIds('shipdot:default')).toEqual(['search', 'bug'])
    expect(events).toEqual([['search'], ['bug']])
  })

  it('still applies first-visit when IDs arrive before the feed', async () => {
    mockFeed()
    const el = await mount({ 'first-visit': 'show-latest' }, (el) => el.markRead(['export']))
    expect(el.unread).toEqual([])
    expect(readIds('shipdot:default')).toEqual(['export', 'search', 'bug'])
  })

  it('does not carry read state over to a new storage-key', async () => {
    writeIds('shipdot:a', ['export', 'search', 'bug'])
    writeIds('shipdot:b', [])
    mockFeed()
    const el = await mount({ 'storage-key': 'a', hotspots: 'off' })
    expect(el.unread).toEqual([])
    const ready = new Promise((resolve) => el.addEventListener('shipdot:ready', resolve))
    el.setAttribute('storage-key', 'b')
    await ready
    expect(el.unread).toHaveLength(3)
  })

  it('reports fetch errors and invalid feeds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFeed({ message: 'nope' }, 404)
    const errors: string[] = []
    document.addEventListener('shipdot:error', (e) =>
      errors.push((e as ShipDotEventMap['shipdot:error']).detail.error.message),
    )
    await mount()
    mockFeed({ version: 2, entries: [] })
    await mount()
    expect(errors[0]).toMatch(/could not load .*\(404\)/)
    expect(errors[1]).toMatch(/is not a shipdot.json v1 feed/)
  })

  it('keeps the feed of the latest src when an older request finishes last', async () => {
    let releaseOld = () => {}
    const old = new Promise<void>((resolve) => {
      releaseOld = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        if (url.pathname === '/old.json') {
          await old
          return new Response(JSON.stringify(feed))
        }
        return new Response(JSON.stringify({ ...feed, entries: [feed.entries[1]] }))
      }),
    )
    const el = document.createElement('ship-dot')
    el.setAttribute('src', '/old.json')
    document.body.append(el)
    const ready = new Promise((resolve) =>
      el.addEventListener('shipdot:ready', resolve, { once: true }),
    )
    el.setAttribute('src', '/new.json')
    await ready
    releaseOld()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(el.entries.map((e) => e.id)).toEqual(['search'])
  })

  it('refetches the feed when the tab comes back after 10 minutes', async () => {
    const fetchMock = mockFeed()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const el = await mount({ hotspots: 'off' })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), { cache: 'no-cache' })
    const comeBack = (minutes: number) => {
      now.mockReturnValue(1_000_000 + minutes * 60_000)
      document.dispatchEvent(new Event('visibilitychange'))
    }
    comeBack(5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const fresh = { id: 'fresh', date: '2026-10-20', type: 'new', title: 'Fresh', html: '' }
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ ...feed, entries: [fresh, ...feed.entries] })),
    )
    const ready = new Promise((resolve) =>
      el.addEventListener('shipdot:ready', resolve, { once: true }),
    )
    comeBack(11)
    await ready
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(el.unread.map((e) => e.id)).toEqual(['fresh'])
  })

  it('sets aria-expanded on a slotted custom trigger', async () => {
    mockFeed()
    const el = await mount({ hotspots: 'off' }, (el) => {
      el.innerHTML = '<button type="button">Updates</button>'
    })
    const custom = el.querySelector('button') as HTMLButtonElement
    el.open()
    expect(custom.getAttribute('aria-expanded')).toBe('true')
    expect(custom.getAttribute('aria-haspopup')).toBe('dialog')
    el.close()
    expect(custom.getAttribute('aria-expanded')).toBe('false')
  })

  it('creates hotspots for unread entries with a target', async () => {
    writeIds('shipdot:default', ['search', 'bug'])
    document.body.innerHTML = '<button id="btn-export">Export</button>'
    mockFeed()
    const el = await mount()
    const layer = document.querySelector('.shipdot-layer') as HTMLElement
    const dot = layer.shadowRoot?.querySelector('[part="hotspot"]') as HTMLButtonElement
    expect(dot.getAttribute('aria-label')).toBe('New: Export to Excel')
    el.markAllRead()
    expect(document.querySelector('.shipdot-layer')).toBeNull()
  })

  it('keeps the hotspot layer when an entry without a target is read', async () => {
    writeIds('shipdot:default', [])
    document.body.innerHTML = '<button id="btn-export">Export</button>'
    mockFeed()
    const el = await mount()
    const layer = document.querySelector('.shipdot-layer')
    el.markRead(['search'])
    expect(document.querySelector('.shipdot-layer')).toBe(layer)
    el.setAttribute('locale', 'es')
    expect(document.querySelector('.shipdot-layer')).not.toBe(layer)
  })

  it('syncs reads between widgets with the same storage key, without a second read event', async () => {
    writeIds('shipdot:default', [])
    writeIds('shipdot:other', [])
    mockFeed()
    const a = await mount({ hotspots: 'off' })
    const b = await mount({ hotspots: 'off' })
    const other = await mount({ hotspots: 'off', 'storage-key': 'other' })
    const events: string[][] = []
    b.addEventListener('shipdot:read', (e) =>
      events.push((e as ShipDotEventMap['shipdot:read']).detail.ids),
    )
    a.markRead(['search'])
    await vi.waitFor(() => expect(b.unread.map((e) => e.id)).toEqual(['export', 'bug']))
    expect(badge(b).textContent).toBe('2')
    expect(other.unread).toHaveLength(3)
    expect(events).toEqual([])
  })

  it('draws hotspots once per storage key and hands them over on removal', async () => {
    writeIds('shipdot:default', [])
    document.body.innerHTML = '<button id="btn-export">Export</button>'
    mockFeed()
    const a = await mount()
    await mount()
    expect(document.querySelectorAll('.shipdot-layer')).toHaveLength(1)
    a.remove()
    await vi.waitFor(() => expect(document.querySelectorAll('.shipdot-layer')).toHaveLength(1))
  })

  it('does not create hotspots when disabled', async () => {
    writeIds('shipdot:default', [])
    mockFeed()
    await mount({ hotspots: 'off' })
    expect(document.querySelector('.shipdot-layer')).toBeNull()
  })

  it('cleans up the hotspot layer when removed', async () => {
    writeIds('shipdot:default', [])
    mockFeed()
    const el = await mount()
    expect(document.querySelector('.shipdot-layer')).not.toBeNull()
    el.remove()
    expect(document.querySelector('.shipdot-layer')).toBeNull()
  })
})
