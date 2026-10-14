// Renders the README screenshots from the built docs playground with Playwright.
// Usage: pnpm docs:build && node scripts/screenshot.ts
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../apps/docs/dist/', import.meta.url))
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(
    /^\/shipdot/,
    '',
  )
  let file = normalize(join(root, path))
  if (!extname(file)) file = join(file, 'index.html')
  try {
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch {
    res.writeHead(404).end()
  }
}).listen(4399)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 })
await page.emulateMedia({ colorScheme: 'light' })
await page.goto('http://localhost:4399/shipdot/playground/')
await page.locator('[data-control="locale"]').selectOption('en')
await page.locator('[data-control="theme"]').selectOption('light')
const preview = page.locator('.pg-window')
await preview.scrollIntoViewIfNeeded()
await page.getByRole('button', { name: 'New: Export to Excel' }).click()
await page.waitForTimeout(400)
const box = await preview.boundingBox()
if (!box) throw new Error('preview not found')
const clip = { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 }
await page.screenshot({ path: '.github/assets/hotspot.png', clip })
await page.keyboard.press('Escape')
await page
  .locator('.pg-widget')
  .getByRole('button', { name: /what's new/i })
  .click()
await page.waitForTimeout(400)
await page.screenshot({ path: '.github/assets/panel.png', clip })
await browser.close()
server.close()
console.log('Wrote .github/assets/hotspot.png and .github/assets/panel.png')
