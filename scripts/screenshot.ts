// Renders the README images with Playwright: the real <ship-dot> build on a showcase stage
// (scripts/showcase/stage.html), fed by the entries in scripts/showcase/entries compiled
// exactly like `shipdot build` does.
// Usage: pnpm build:packages && node scripts/screenshot.ts
import { readdir, readFile } from 'node:fs/promises'
import { chromium, type Page } from '@playwright/test'
import { compile } from '../packages/core/dist/compile.js'

const dir = (path: string) => new URL(path, import.meta.url)
const ENTRY = '2026-10-14-export-excel.md'
const ORIGIN = 'http://showcase.test'

const names = (await readdir(dir('showcase/entries/'))).filter((name) => name.endsWith('.md'))
const sources = await Promise.all(
  names.map(async (name) => ({
    path: name,
    content: await readFile(dir(`showcase/entries/${name}`), 'utf8'),
  })),
)
const result = compile(sources, { defaultLocale: 'en', locales: ['en'] })
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics, null, 2))

const files: Record<string, { body: string | Buffer; type: string }> = {
  '/': { body: await readFile(dir('showcase/stage.html')), type: 'text/html' },
  '/shipdot.js': {
    body: await readFile(dir('../packages/shipdot/dist/shipdot.js')),
    type: 'text/javascript',
  },
  '/shipdot.json': { body: JSON.stringify(result.feed), type: 'application/json' },
}
for (const file of sources)
  files[`/entries/${file.path}`] = { body: file.content, type: 'text/markdown' }

/** The hero opens the hotspot tooltip on Export; the panel scene opens "What's new". */
const scenes: Record<string, { height: number; act: (page: Page) => Promise<void> }> = {
  hero: {
    height: 640,
    act: (page) => page.getByRole('button', { name: 'New: Export to Excel' }).click(),
  },
  panel: {
    height: 720,
    act: (page) => page.getByRole('button', { name: /what's new/i }).click(),
  },
}

const browser = await chromium.launch()
const written: string[] = []
for (const theme of ['light', 'dark'] as const) {
  const context = await browser.newContext({ deviceScaleFactor: 2, colorScheme: theme })
  await context.route(`${ORIGIN}/**`, (route) => {
    const file = files[new URL(route.request().url()).pathname]
    return file
      ? route.fulfill({ body: file.body, contentType: file.type })
      : route.fulfill({ status: 404 })
  })
  // Every entry starts unread, so the badge and the hotspots show up.
  await context.addInitScript(() => localStorage.setItem('shipdot:showcase', '[]'))
  for (const [scene, { height, act }] of Object.entries(scenes)) {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1040, height })
    await page.goto(`${ORIGIN}/?theme=${theme}&scene=${scene}&entry=${ENTRY}`)
    await page.waitForSelector('html[data-ready]')
    await act(page)
    await page.mouse.move(0, 0)
    // Freeze the hotspot pulse mid-ring so the still image shows it.
    await page.evaluate(() => {
      const layer = document.querySelector('.shipdot-layer')
      for (const animation of layer?.shadowRoot?.getAnimations() ?? []) {
        animation.pause()
        animation.currentTime = 650
      }
    })
    await page.waitForTimeout(300)
    const path = `.github/assets/${scene}-${theme}.png`
    await page.screenshot({ path, omitBackground: true })
    written.push(path)
    await page.close()
  }
  await context.close()
}
await browser.close()
console.log(`Wrote ${written.join(', ')}`)
