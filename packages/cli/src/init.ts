import { access, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CONFIG_FILE, CONFIG_SCHEMA_URL, DEFAULT_CONFIG, isLocale } from '@shipdot/core'
import pkg from '../package.json' with { type: 'json' }

export interface InitOptions {
  cwd: string
  outDir?: string
  locales?: string[]
  /** `YYYY-MM-DD` used for the example entry. */
  today?: string
}

export interface InitResult {
  created: string[]
  skipped: string[]
  outDir: string
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  )

/** Picks the folder a framework serves as-is: `public/` (Vite, Next, Astro…) or `static/`. */
async function detectOutDir(cwd: string): Promise<string> {
  for (const dir of ['public', 'static']) if (await exists(join(cwd, dir))) return dir
  return DEFAULT_CONFIG.outDir
}

/**
 * Version range for CDN URLs. The widget shares its version with the CLI. In `0.x` a minor
 * release may break, so pin `major.minor`; from 1.0 on, the major is enough.
 */
function cdnRange(version: string): string {
  const [major = '0', minor = '0'] = version.split('.')
  return major === '0' ? `${major}.${minor}` : major
}

export const WIDGET_SNIPPET: string = `<script type="module" src="https://unpkg.com/shipdot@${cdnRange(pkg.version)}"></script>
<ship-dot src="/shipdot.json"></ship-dot>`

export const WORKFLOW_SNIPPET = `# .github/workflows/shipdot.yml
name: shipdot
on:
  workflow_dispatch:
  schedule:
    - cron: '0 9 * * 1' # Mondays 09:00 UTC
permissions:
  contents: read
jobs:
  draft:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v7
      - uses: pipe1os/shipdot@v0
        with:
          command: draft`

/** Creates `shipdot.config.json` and an example entry. Never overwrites existing files. */
export async function initProject(options: InitOptions): Promise<InitResult> {
  const cwd = resolve(options.cwd)
  const created: string[] = []
  const skipped: string[] = []
  const outDir = options.outDir ?? (await detectOutDir(cwd))
  const locales = options.locales?.filter(isLocale).length
    ? options.locales.filter(isLocale)
    : ['en']
  const today = options.today ?? new Date().toISOString().slice(0, 10)

  const configPath = join(cwd, CONFIG_FILE)
  if (await exists(configPath)) skipped.push(CONFIG_FILE)
  else {
    const config = {
      $schema: CONFIG_SCHEMA_URL,
      entriesDir: DEFAULT_CONFIG.entriesDir,
      outDir,
      defaultLocale: locales[0],
      locales,
    }
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`)
    created.push(CONFIG_FILE)
  }

  const entriesDir = join(cwd, DEFAULT_CONFIG.entriesDir)
  await mkdir(entriesDir, { recursive: true })
  const name = `${today}-welcome.md`
  const entryPath = join(entriesDir, name)
  if (await exists(entryPath)) skipped.push(`${DEFAULT_CONFIG.entriesDir}/${name}`)
  else {
    await writeFile(
      entryPath,
      `---
date: ${today}
type: new
title: Say hello to What's new
# target: "#some-button"   # uncomment to put a hotspot on that element
# link: https://example.com/docs
---
This is where we will tell you about new features and fixes, right inside the app.
`,
    )
    created.push(`${DEFAULT_CONFIG.entriesDir}/${name}`)
  }
  return { created, skipped, outDir }
}
