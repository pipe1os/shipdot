import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from '@shipdot/cli'
import { validateFeed } from '@shipdot/core'
import { afterEach, describe, expect, it } from 'vitest'

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const temps: string[] = []

async function tempDir(fixture?: string) {
  const dir = await mkdtemp(join(tmpdir(), 'shipdot-cli-'))
  temps.push(dir)
  if (fixture) await cp(join(fixtures, fixture), dir, { recursive: true })
  return dir
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function cli(args: string[], cwd: string) {
  let stdout = ''
  let stderr = ''
  const code = await run(args, {
    cwd,
    env: {},
    stdout: (t) => {
      stdout += t
    },
    stderr: (t) => {
      stderr += t
    },
  })
  return { code, stdout, stderr }
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

describe('shipdot (no command)', () => {
  it('prints help and the version', async () => {
    const dir = await tempDir()
    const help = await cli([], dir)
    expect(help.code).toBe(0)
    expect(help.stdout).toContain('Usage')
    expect(help.stdout).toContain('draft')
    const version = await cli(['--version'], dir)
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('rejects unknown commands and options', async () => {
    const dir = await tempDir()
    expect((await cli(['ship'], dir)).stderr).toContain('unknown command "ship"')
    const bad = await cli(['build', '--repo', 'x/y'], dir)
    expect(bad.code).toBe(1)
    expect(bad.stderr).toContain('"--repo" is not an option of "shipdot build"')
  })

  it('prints help per command', async () => {
    const dir = await tempDir()
    const { code, stdout } = await cli(['draft', '--help'], dir)
    expect(code).toBe(0)
    expect(stdout).toContain('SHIPDOT_LLM_PROVIDER')
  })
})

describe('shipdot init', () => {
  it('creates a config and an example entry that builds', async () => {
    const dir = await tempDir()
    const init = await cli(['init', '--locales', 'en,es'], dir)
    expect(init.code).toBe(0)
    expect(init.stdout).toContain('<ship-dot src="/shipdot.json"></ship-dot>')
    const config = JSON.parse(await readFile(join(dir, 'shipdot.config.json'), 'utf8'))
    expect(config).toMatchObject({ outDir: 'public', defaultLocale: 'en', locales: ['en', 'es'] })

    const build = await cli(['build'], dir)
    expect(build.code).toBe(0)
    const feed = JSON.parse(await readFile(join(dir, 'public/shipdot.json'), 'utf8'))
    expect(validateFeed(feed)).toEqual([])
    expect(feed.entries).toHaveLength(1)
  })

  it('detects static/ and never overwrites existing files', async () => {
    const dir = await tempDir()
    await cp(join(fixtures, 'valid/shipdot.config.json'), join(dir, 'static/keep'), {
      recursive: true,
    })
    await writeFile(join(dir, 'shipdot.config.json'), '{"outDir":"mine"}')
    const { stdout } = await cli(['init'], dir)
    expect(stdout).toContain('shipdot.config.json (exists, left untouched)')
    expect(await readFile(join(dir, 'shipdot.config.json'), 'utf8')).toBe('{"outDir":"mine"}')

    const other = await tempDir()
    await cp(join(fixtures, 'valid/shipdot.config.json'), join(other, 'static/keep'))
    await cli(['init'], other)
    expect(JSON.parse(await readFile(join(other, 'shipdot.config.json'), 'utf8')).outDir).toBe(
      'static',
    )
  })
})

describe('shipdot build', () => {
  it('writes the feed, llms.txt and copies assets', async () => {
    const dir = await tempDir('valid')
    const { code, stdout } = await cli(['build'], dir)
    expect(code).toBe(0)
    expect(stdout).toContain(
      'Built 2 entries → dist-site/shipdot.json, dist-site/llms.txt, dist-site/llms-full.txt',
    )
    const feed = JSON.parse(await readFile(join(dir, 'dist-site/shipdot.json'), 'utf8'))
    expect(validateFeed(feed)).toEqual([])
    expect(feed.entries.map((e: { id: string }) => e.id)).toEqual([
      '2026-10-14-export-excel',
      '2026-09-01-faster-search',
    ])
    expect(feed.entries[0].image).toBe('shipdot-assets/img/export.png')
    expect(feed.entries[0].i18n.es.title).toBe('Exportar a Excel')
    expect(await exists(join(dir, 'dist-site/shipdot-assets/img/export.png'))).toBe(true)
    expect(await readFile(join(dir, 'dist-site/llms.txt'), 'utf8')).toContain("# Acme: what's new")
  })

  it('supports --cwd and --config', async () => {
    const dir = await tempDir()
    const project = await tempDir('valid')
    const { code } = await cli(['build', '--cwd', project, '--config', 'shipdot.config.json'], dir)
    expect(code).toBe(0)
  })

  it('fails without writing when an image is missing', async () => {
    const dir = await tempDir('valid')
    await rm(join(dir, '.shipdot/entries/img/export.png'))
    const { code, stderr } = await cli(['build'], dir)
    expect(code).toBe(1)
    expect(stderr).toContain('.shipdot/entries/img/export.png - error: image not found')
    expect(await exists(join(dir, 'dist-site/shipdot.json'))).toBe(false)
  })

  it('reports invalid config files', async () => {
    const dir = await tempDir()
    await writeFile(join(dir, 'shipdot.config.json'), '{ "outdir": "x", "locales": "en" }')
    const { code, stderr } = await cli(['build'], dir)
    expect(code).toBe(1)
    expect(stderr).toContain('shipdot.config.json - error: outdir: unknown option')
    expect(stderr).toContain('locales: must be an array of locale tags')
    await writeFile(join(dir, 'shipdot.config.json'), '{ nope')
    expect((await cli(['build'], dir)).stderr).toContain('invalid JSON')
  })
})

describe('shipdot validate', () => {
  it('prints file:line:column errors and exits 1', async () => {
    const dir = await tempDir('broken')
    const { code, stderr, stdout } = await cli(['validate'], dir)
    expect(code).toBe(1)
    expect(stdout).toBe('')
    const lines = stderr.trim().split('\n')
    expect(lines).toEqual([
      '.shipdot/entries/a.md:3:1 - error: invalid date "2026-02-30": use a real date as YYYY-MM-DD',
      '.shipdot/entries/a.md:4:1 - error: unknown type "feature": use new | improved | fixed',
      '.shipdot/entries/b.md:2:1 - error: duplicate id "same" (already used by a.md)',
      '.shipdot/entries/b.fr.md:1:1 - error: locale "fr" is not declared in shipdot.config.json "locales" (en, es)',
      '.shipdot/entries/ghost.es.md:1:1 - error: orphan translation: ghost.md does not exist',
      '✖ Found 5 errors.',
    ])
  })

  it('succeeds on valid entries without writing', async () => {
    const dir = await tempDir('valid')
    const { code, stdout } = await cli(['validate'], dir)
    expect(code).toBe(0)
    expect(stdout).toContain('2 entries valid (en, es)')
    expect(await exists(join(dir, 'dist-site'))).toBe(false)
  })

  it('treats a missing entries folder as an empty feed', async () => {
    const dir = await tempDir()
    const { code, stdout } = await cli(['validate'], dir)
    expect(code).toBe(0)
    expect(stdout).toContain('0 entries valid (en)')
  })
})
