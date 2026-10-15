import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DraftResult } from '@shipdot/cli'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pullBody, run } from '../src/action'

const fixture = fileURLToPath(new URL('../../packages/cli/test/fixtures/valid/', import.meta.url))

let dir: string
let stdout: string
const saved = { ...process.env }

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shipdot-action-'))
  await cp(fixture, join(dir, 'app'), { recursive: true })
  await writeFile(join(dir, 'output.txt'), '')
  stdout = ''
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk)
    return true
  })
  process.exitCode = undefined
  Object.assign(process.env, {
    GITHUB_WORKSPACE: dir,
    GITHUB_OUTPUT: join(dir, 'output.txt'),
    GITHUB_REPOSITORY: 'acme/app',
    'INPUT_WORKING-DIRECTORY': 'app',
    'INPUT_GITHUB-TOKEN': 'ghs_secret',
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  process.env = { ...saved }
  process.exitCode = undefined
  await rm(dir, { recursive: true, force: true })
})

const outputs = async () => readFile(join(dir, 'output.txt'), 'utf8')

function github(pulls: unknown[], calls: { method: string; url: string; body: unknown }[] = []) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url, body })
    const json = (value: unknown) => new Response(JSON.stringify(value))
    if (url.includes('/pulls?state=closed')) return json(pulls)
    if (url.includes('/pulls?state=open')) return json([])
    if (url.endsWith('/repos/acme/app')) return json({ default_branch: 'main' })
    if (url.endsWith('/graphql')) return json({ data: { repository: { refs: { nodes: [] } } } })
    if (url.includes('/git/ref/heads/')) return json({ object: { sha: 'base' } })
    if (url.includes('/git/commits/base')) return json({ tree: { sha: 'tree' } })
    if (url.endsWith('/git/trees')) return json({ sha: 'new-tree' })
    if (url.endsWith('/git/commits')) return json({ sha: 'commit' })
    if (url.endsWith('/git/refs')) return json({})
    if (url.endsWith('/pulls'))
      return json({ number: 9, html_url: 'https://github.com/acme/app/pull/9' })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
}

const merged = {
  number: 31,
  title: 'feat: add dark mode @someone | x',
  body: null,
  html_url: 'https://github.com/acme/app/pull/31',
  merged_at: '2026-10-15T10:00:00Z',
  updated_at: '2026-10-15T10:00:00Z',
  user: { login: 'dev', type: 'User' },
  labels: [],
  head: { ref: 'dark-mode' },
}

describe('build', () => {
  it('writes the feed in the working directory', async () => {
    process.env.INPUT_COMMAND = 'build'
    await run()
    expect(process.exitCode).toBeUndefined()
    expect(await outputs()).toContain('entries')
    const feed = JSON.parse(await readFile(join(dir, 'app/dist-site/shipdot.json'), 'utf8'))
    expect(feed.entries).toHaveLength(2)
  })

  it('fails with annotations on invalid entries', async () => {
    process.env.INPUT_COMMAND = 'build'
    await writeFile(
      join(dir, 'app/.shipdot/entries/bad.md'),
      '---\ndate: nope\ntype: new\ntitle: X\n---\n',
    )
    await run()
    expect(process.exitCode).toBe(1)
    expect(stdout).toContain('::error file=app/.shipdot/entries/bad.md,line=2::invalid date "nope"')
  })
})

describe('draft', () => {
  it('masks secrets and opens a pull request with the drafts', async () => {
    process.env['INPUT_LLM-API-KEY'] = 'sk-ant-secret'
    const calls: { method: string; url: string; body: unknown }[] = []
    await run({ fetch: github([merged], calls), today: '2026-10-16' })
    expect(process.exitCode).toBeUndefined()
    expect(stdout).toContain('::add-mask::ghs_secret')
    expect(stdout).toContain('::add-mask::sk-ant-secret')

    const tree = calls.find((c) => c.url.endsWith('/git/trees'))?.body as {
      tree: { path: string; content: string }[]
    }
    expect(tree.tree.map((t) => t.path)).toEqual([
      'app/.shipdot/entries/2026-10-15-add-dark-mode-someone-x.md',
    ])
    expect(tree.tree[0]?.content).toContain('pr: 31')
    const ref = calls.find((c) => c.url.endsWith('/git/refs'))?.body
    expect(ref).toEqual({ ref: 'refs/heads/shipdot/draft-2026-10-16', sha: 'commit' })
    const pull = calls.find((c) => c.method === 'POST' && c.url.endsWith('/pulls'))?.body as {
      title: string
      body: string
    }
    expect(pull.title).toBe('docs(shipdot): draft 1 in-app release note')
    expect(await outputs()).toContain('https://github.com/acme/app/pull/9')
    // The API key never reaches GitHub, and the token only travels in the Authorization header.
    expect(JSON.stringify(calls)).not.toContain('sk-ant-secret')
    expect(JSON.stringify(calls)).not.toContain('ghs_secret')
  })

  it('does nothing when there is nothing to draft', async () => {
    const calls: { method: string; url: string; body: unknown }[] = []
    await run({ fetch: github([], calls) })
    expect(process.exitCode).toBeUndefined()
    expect(stdout).toContain('Nothing to draft.')
    expect(calls.some((c) => c.method === 'POST' && !c.url.endsWith('/graphql'))).toBe(false)
  })

  it('reports unknown commands', async () => {
    process.env.INPUT_COMMAND = 'deploy'
    await run()
    expect(process.exitCode).toBe(1)
    expect(stdout).toContain('Unknown command "deploy"')
  })
})

describe('pullBody', () => {
  it('escapes untrusted titles and opts itself out of drafting', () => {
    const result: DraftResult = {
      repo: 'acme/app',
      base: 'main',
      since: { date: '2026-10-01', source: 'tag', ref: 'v1.0.0' },
      files: [],
      drafted: [
        {
          number: 1,
          title: 'Hi @team | <img src=x>',
          url: '',
          path: '.shipdot/entries/a.md',
          mode: 'template',
        },
      ],
      skipped: [{ number: 2, title: 'chore: deps\nnewline', reason: 'type "chore"' }],
    }
    const body = pullBody(result)
    expect(body).toContain('since tag `v1.0.0`')
    expect(body).toContain(
      '| #1 Hi @​team \\| &lt;img src=x> | `.shipdot/entries/a.md` | template |',
    )
    expect(body).toContain('- #2 chore: deps newline: type "chore"')
    expect(body.trim().endsWith('### shipdot\n\nskip')).toBe(true)
  })
})
