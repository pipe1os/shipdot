import { formatDiagnostic } from '@shipdot/core'
import { compile, type SourceFile } from '@shipdot/core/compile'
import 'shipdot'
import { NEW_ENTRY, SAMPLES } from './samples'

/** Everything a shared link restores. Kept in the URL hash, so it never reaches a server. */
interface State {
  files: SourceFile[]
  mode?: string
  theme?: string
  locale?: string
  brand?: string
}

type Problem = [severity: string, text: string]

const CONTROLS = ['mode', 'theme', 'locale', 'brand'] as const

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const encodeState = async (state: State): Promise<string> => {
  const stream = new Blob([JSON.stringify(state)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))
}

/** Reads a state from a URL hash. Anything malformed is ignored and the samples load instead. */
const decodeState = async (hash: string): Promise<State | undefined> => {
  try {
    const binary = atob(hash.replaceAll('-', '+').replaceAll('_', '/'))
    const stream = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    const value = JSON.parse(await new Response(stream).text()) as State
    const valid =
      Array.isArray(value?.files) &&
      value.files.every((f) => typeof f?.path === 'string' && typeof f?.content === 'string')
    return valid ? value : undefined
  } catch {
    return undefined
  }
}

/** Text color with the higher contrast on a `#rrggbb` background (WCAG relative luminance). */
const textOn = (hex: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (l + 0.05) > (l + 0.05) / 0.05 ? '#ffffff' : '#0b1120'
}

const today = (): string => new Date().toISOString().slice(0, 10)

/** Wires the playground markup rendered by Playground.astro. */
export async function mountPlayground(root: HTMLElement): Promise<void> {
  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T
  const widget = $<HTMLElement & { refresh(): Promise<void> }>('ship-dot')
  const list = $<HTMLElement>('[data-entries]')
  const template = $<HTMLTemplateElement>('[data-entry-template]')
  const status = $<HTMLElement>('[data-status]')
  const outputs = {
    feed: $<HTMLDetailsElement>('[data-output="feed"]'),
    llms: $<HTMLDetailsElement>('[data-output="llms"]'),
  }
  const app = $<HTMLElement>('[data-app]')
  const control = (name: (typeof CONTROLS)[number]) =>
    $<HTMLInputElement | HTMLSelectElement>(`[data-control="${name}"]`)
  const brandDefault = control('brand').value
  let feedUrl: string | undefined
  let timer = 0
  let count = 0
  let resets = 0
  let statusKey = ''
  let generated = { feed: '', llms: '' }

  const files = (): SourceFile[] =>
    [...list.querySelectorAll<HTMLElement>('[data-entry]')].map((card) => ({
      path: (card.querySelector('input') as HTMLInputElement).value.trim(),
      content: (card.querySelector('textarea') as HTMLTextAreaElement).value,
    }))

  const state = (): State => {
    const value: State = { files: files() }
    for (const name of CONTROLS) value[name] = control(name).value
    return value
  }
  const samplesHash = encodeState({ ...state(), files: SAMPLES })

  // The generated files are only rendered while their panel is open.
  const renderOutputs = () => {
    for (const [name, details] of Object.entries(outputs))
      if (details.open)
        (details.querySelector('pre') as HTMLElement).textContent =
          generated[name as keyof typeof outputs]
  }

  const renderStatus = (ok: boolean, entries: number, problems: Problem[]) => {
    const summary = ok
      ? `Compiled ${entries} entr${entries === 1 ? 'y' : 'ies'}, sanitized exactly like shipdot build.`
      : `${problems.filter(([severity]) => severity === 'error').length} error(s). Valid entries are still shown.`
    // Only touch the live region when the message changes, so screen readers are not
    // interrupted on every pause in typing.
    const key = JSON.stringify([summary, problems])
    if (key === statusKey) return
    statusKey = key
    status.dataset.state = ok ? 'ok' : 'error'
    const p = document.createElement('p')
    p.textContent = summary
    status.replaceChildren(p)
    if (problems.length) {
      const ul = document.createElement('ul')
      for (const [severity, text] of problems) {
        const li = document.createElement('li')
        li.textContent = text
        li.dataset.severity = severity
        ul.append(li)
      }
      status.append(ul)
    }
  }

  const update = () => {
    clearTimeout(timer)
    const sources = files()
    const result = compile(sources, {
      defaultLocale: 'en',
      locales: ['en', 'es', 'pt'],
      name: 'Acme Analytics',
      description: 'Product updates for Acme Analytics.',
      url: 'https://app.acme.example',
    })
    const problems = result.diagnostics.map((d): Problem => [d.severity, formatDiagnostic(d)])
    for (const file of sources)
      if (!file.path.endsWith('.md'))
        problems.push(['warning', `${file.path}: file names must end in .md`])
    renderStatus(result.ok, result.feed.entries.length, problems)

    generated = { feed: JSON.stringify(result.feed, null, 2), llms: result.llms }
    renderOutputs()
    const previous = feedUrl
    feedUrl = URL.createObjectURL(
      new Blob([JSON.stringify(result.feed)], { type: 'application/json' }),
    )
    widget.setAttribute('src', feedUrl)
    if (previous) setTimeout(() => URL.revokeObjectURL(previous), 10_000)
    void saveHash()
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = window.setTimeout(update, 250)
  }

  // The URL always reflects the playground, so a reload keeps the edits and "Copy link" shares them.
  const saveHash = async () => {
    const hash = await encodeState(state())
    const url = hash === (await samplesHash) ? location.pathname : `#${hash}`
    history.replaceState(history.state, '', url)
  }

  const addEntry = (file: SourceFile) => {
    const card = (template.content.cloneNode(true) as DocumentFragment)
      .firstElementChild as HTMLElement
    const id = `pg-entry-${++count}`
    const input = card.querySelector('input') as HTMLInputElement
    const textarea = card.querySelector('textarea') as HTMLTextAreaElement
    input.value = file.path
    input.id = `${id}-name`
    textarea.value = file.content
    // Named after the file name field, so renaming the file renames the editor too.
    textarea.setAttribute('aria-labelledby', input.id)
    ;(card.querySelector('label') as HTMLLabelElement).htmlFor = input.id
    const remove = card.querySelector('[data-remove]') as HTMLButtonElement
    remove.setAttribute('aria-labelledby', `${id}-remove ${input.id}`)
    remove.id = `${id}-remove`
    remove.onclick = () => {
      const next = card.nextElementSibling ?? card.previousElementSibling
      card.remove()
      update()
      // Keep focus in the list instead of dropping it on <body>.
      ;(
        (next?.querySelector('textarea') as HTMLElement | null) ??
        $<HTMLElement>('[data-action="add"]')
      ).focus()
    }
    list.append(card)
  }

  const load = (value: State) => {
    list.replaceChildren()
    count = 0
    for (const file of value.files) addEntry(file)
    for (const name of CONTROLS) {
      const el = control(name)
      const saved = value[name]
      // Values come from the URL: only known options and #rrggbb colors are taken.
      const valid =
        typeof saved === 'string' &&
        (el instanceof HTMLSelectElement
          ? [...el.options].some((o) => o.value === saved)
          : /^#[0-9a-f]{6}$/i.test(saved))
      el.value = valid
        ? saved
        : el instanceof HTMLSelectElement
          ? (el.options[0]?.value ?? '')
          : brandDefault
      applyControl(name)
    }
  }

  // Theme: "auto" follows the docs site theme so the fake app and the widget always match.
  const applyTheme = () => {
    const value = control('theme').value
    const theme =
      value === 'auto'
        ? document.documentElement.dataset.theme === 'light'
          ? 'light'
          : 'dark'
        : value
    app.dataset.theme = theme
    widget.setAttribute('theme', theme)
  }
  new MutationObserver(applyTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  const applyControl = (name: (typeof CONTROLS)[number]) => {
    const { value } = control(name)
    if (name === 'theme') applyTheme()
    else if (name === 'brand') {
      // The default keeps each theme's own brand shade; a picked color applies to both.
      const picked = value !== brandDefault
      app.style.setProperty('--brand', picked ? value : null)
      app.style.setProperty('--brand-fg', picked ? textOn(value) : null)
    } else if (value) widget.setAttribute(name, value)
    else widget.removeAttribute(name)
  }

  for (const name of CONTROLS)
    control(name).addEventListener('input', () => {
      applyControl(name)
      void saveHash()
    })
  for (const details of Object.values(outputs)) details.addEventListener('toggle', renderOutputs)

  // The widget merges stored read IDs into the ones it holds in memory, so emptying storage is
  // not enough: switching to a fresh storage key resets both.
  $<HTMLButtonElement>('[data-action="reset"]').onclick = () => {
    const key = `playground-${resets++ % 2}`
    try {
      localStorage.setItem(`shipdot:${key}`, '[]')
    } catch {
      // Storage disabled: the widget keeps read state in memory.
    }
    widget.setAttribute('storage-key', key)
  }
  $<HTMLButtonElement>('[data-action="add"]').onclick = () => {
    addEntry({ path: `${today()}-entry-${count + 1}.md`, content: NEW_ENTRY(today()) })
    update()
    list.lastElementChild?.querySelector('textarea')?.focus()
  }
  $<HTMLButtonElement>('[data-action="restore"]').onclick = () => {
    load({ files: SAMPLES })
    update()
  }
  const copy = $<HTMLButtonElement>('[data-action="copy"]')
  copy.onclick = async () => {
    update()
    await saveHash()
    try {
      await navigator.clipboard.writeText(location.href)
      copy.textContent = 'Link copied'
    } catch {
      copy.textContent = 'Copy the address bar'
    }
    setTimeout(() => {
      copy.textContent = 'Copy link'
    }, 2000)
  }
  list.addEventListener('input', schedule)

  $<HTMLButtonElement>('[data-action="reset"]').click()
  load((location.hash && (await decodeState(location.hash.slice(1)))) || { files: SAMPLES })
  update()
}
