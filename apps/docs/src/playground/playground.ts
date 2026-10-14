import { formatDiagnostic } from '@shipdot/core'
import { compile, type SourceFile } from '@shipdot/core/compile'
import 'shipdot'
import { NEW_ENTRY, SAMPLES } from './samples'

const STORAGE_KEY = 'shipdot:playground'

const resetReadState = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, '[]')
  } catch {
    // Storage disabled: the widget keeps read state in memory.
  }
}

/** Wires the playground markup rendered by Playground.astro. */
export function mountPlayground(root: HTMLElement): void {
  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T
  const widget = $<HTMLElement & { refresh(): Promise<void> }>('ship-dot')
  const list = $<HTMLElement>('[data-entries]')
  const template = $<HTMLTemplateElement>('[data-entry-template]')
  const status = $<HTMLElement>('[data-status]')
  const output = $<HTMLElement>('[data-output]')
  const app = $<HTMLElement>('[data-app]')
  let feedUrl: string | undefined
  let timer = 0
  let count = 0

  const files = (): SourceFile[] =>
    [...list.querySelectorAll<HTMLElement>('[data-entry]')].map((card) => ({
      path: (card.querySelector('input') as HTMLInputElement).value.trim(),
      content: (card.querySelector('textarea') as HTMLTextAreaElement).value,
    }))

  const update = () => {
    const sources = files()
    const result = compile(sources, { defaultLocale: 'en', locales: ['en', 'es', 'pt'] })
    const problems = [...result.diagnostics]
    for (const file of sources)
      if (!file.path.endsWith('.md'))
        problems.push({
          severity: 'warning',
          file: file.path,
          message: 'file names must end in .md',
        })
    status.replaceChildren()
    status.dataset.state = result.ok ? 'ok' : 'error'
    const summary = document.createElement('p')
    const n = result.feed.entries.length
    summary.textContent = result.ok
      ? `✓ Compiled ${n} entr${n === 1 ? 'y' : 'ies'}, sanitized exactly like shipdot build.`
      : `✖ ${problems.filter((d) => d.severity === 'error').length} error(s). Valid entries are still shown.`
    status.append(summary)
    if (problems.length) {
      const ul = document.createElement('ul')
      for (const d of problems) {
        const li = document.createElement('li')
        li.textContent = formatDiagnostic(d)
        li.dataset.severity = d.severity
        ul.append(li)
      }
      status.append(ul)
    }
    output.textContent = JSON.stringify(result.feed, null, 2)
    const previous = feedUrl
    feedUrl = URL.createObjectURL(
      new Blob([JSON.stringify(result.feed)], { type: 'application/json' }),
    )
    widget.setAttribute('src', feedUrl)
    if (previous) setTimeout(() => URL.revokeObjectURL(previous), 10_000)
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = window.setTimeout(update, 250)
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
    textarea.id = `${id}-content`
    textarea.setAttribute('aria-label', `Content of ${file.path}`)
    ;(card.querySelector('label') as HTMLLabelElement).htmlFor = input.id
    ;(card.querySelector('[data-remove]') as HTMLButtonElement).onclick = () => {
      card.remove()
      update()
    }
    list.append(card)
  }

  // Theme: "auto" follows the docs site theme so the fake app and the widget always match.
  const themeSelect = $<HTMLSelectElement>('[data-control="theme"]')
  const applyTheme = () => {
    const value = themeSelect.value
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

  for (const select of root.querySelectorAll<HTMLSelectElement>('[data-control]'))
    select.addEventListener('change', () => {
      const name = select.dataset.control as string
      if (name === 'theme') applyTheme()
      else if (select.value) widget.setAttribute(name, select.value)
      else widget.removeAttribute(name)
    })
  $<HTMLButtonElement>('[data-action="reset"]').onclick = () => {
    resetReadState()
    void widget.refresh()
  }
  $<HTMLButtonElement>('[data-action="add"]').onclick = () => {
    addEntry({ path: `2026-10-20-entry-${count + 1}.md`, content: NEW_ENTRY('2026-10-20') })
    update()
    list.lastElementChild?.querySelector('textarea')?.focus()
  }
  list.addEventListener('input', schedule)

  resetReadState()
  for (const sample of SAMPLES) addEntry(sample)
  applyTheme()
  update()
}
