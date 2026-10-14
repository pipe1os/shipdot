import { GitHub, GitHubError, llmFromEnv, parseRepo } from '@shipdot/cli'
import { describe, expect, it } from 'vitest'
import { mockFetch, pr } from './helpers'

describe('parseRepo', () => {
  it('parses https and ssh remotes', () => {
    expect(parseRepo('https://github.com/pipe1os/shipdot.git')).toBe('pipe1os/shipdot')
    expect(parseRepo('git@github.com:pipe1os/shipdot.git\n')).toBe('pipe1os/shipdot')
    expect(parseRepo('https://github.com/a/b.c')).toBe('a/b.c')
    expect(parseRepo('https://gitlab.com/a/b')).toBeUndefined()
  })
})

describe('GitHub.mergedPulls', () => {
  it('paginates until PRs are older than `since`', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) =>
      pr({
        number: 1000 + i,
        merged_at: '2026-10-10T00:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
      }),
    )
    const page2 = [
      pr({ number: 1, merged_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z' }),
      pr({ number: 2, merged_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }),
    ]
    const { fetch, calls } = mockFetch({
      'GET /pulls?': (call: { url: string }) =>
        call.url.endsWith('&page=1') ? page1 : call.url.endsWith('&page=2') ? page2 : [],
    })
    const github = new GitHub({ repo: 'acme/app', fetch })
    const pulls = await github.mergedPulls('main', new Date('2026-10-01'), 500)
    expect(pulls).toHaveLength(101)
    expect(pulls.at(-1)?.number).toBe(1)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.headers.authorization).toBeUndefined()
  })

  it('throws a readable error on HTTP failures', async () => {
    const { fetch } = mockFetch({})
    const github = new GitHub({ repo: 'acme/app', fetch })
    await expect(github.defaultBranch()).rejects.toThrow(GitHubError)
    await expect(github.defaultBranch()).rejects.toThrow(
      'GitHub GET /repos/acme/app failed: 404 Not Found',
    )
  })
})

describe('GitHub.openPullWithFiles', () => {
  it('creates tree, commit, branch and pull request through the API', async () => {
    const { fetch, calls } = mockFetch({
      'GET /git/ref/heads/main': { object: { sha: 'base-sha' } },
      'GET /git/commits/base-sha': { tree: { sha: 'tree-sha' } },
      'POST /git/trees': { sha: 'new-tree' },
      'POST /git/commits': { sha: 'new-commit' },
      'POST /git/refs': { ref: 'refs/heads/shipdot/draft-2026-10-14' },
      'POST /pulls': { number: 7, html_url: 'https://github.com/acme/app/pull/7' },
    })
    const github = new GitHub({ repo: 'acme/app', token: 't', fetch })
    const result = await github.openPullWithFiles({
      base: 'main',
      branch: 'shipdot/draft-2026-10-14',
      message: 'docs: draft',
      files: [{ path: '.shipdot/entries/a.md', content: '---\n---\n' }],
      title: 'Draft',
      body: 'Body',
    })
    expect(result.number).toBe(7)
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'GET /repos/acme/app/git/ref/heads/main',
      'GET /repos/acme/app/git/commits/base-sha',
      'POST /repos/acme/app/git/trees',
      'POST /repos/acme/app/git/commits',
      'POST /repos/acme/app/git/refs',
      'POST /repos/acme/app/pulls',
    ])
    expect(calls[2]?.body).toEqual({
      base_tree: 'tree-sha',
      tree: [
        { path: '.shipdot/entries/a.md', mode: '100644', type: 'blob', content: '---\n---\n' },
      ],
    })
    expect(calls[3]?.body).toEqual({
      message: 'docs: draft',
      tree: 'new-tree',
      parents: ['base-sha'],
    })
    expect(calls[5]?.body).toEqual({
      title: 'Draft',
      head: 'shipdot/draft-2026-10-14',
      base: 'main',
      body: 'Body',
    })
  })
})

describe('llmFromEnv', () => {
  it('needs a provider and a key', () => {
    const warnings: string[] = []
    const warn = (m: string) => warnings.push(m)
    expect(llmFromEnv({}, undefined, warn)).toBeUndefined()
    expect(llmFromEnv({ SHIPDOT_LLM_PROVIDER: 'anthropic' }, undefined, warn)).toBeUndefined()
    expect(
      llmFromEnv({ SHIPDOT_LLM_PROVIDER: 'gemini', SHIPDOT_LLM_API_KEY: 'k' }, undefined, warn),
    ).toBeUndefined()
    expect(warnings).toEqual([
      'SHIPDOT_LLM_API_KEY is not set, using template mode',
      'unknown SHIPDOT_LLM_PROVIDER "gemini", using template mode',
    ])
  })

  it('combines env variables with the config', () => {
    expect(
      llmFromEnv(
        { SHIPDOT_LLM_API_KEY: 'k', SHIPDOT_LLM_MODEL: 'm2' },
        { provider: 'openai-compatible', model: 'm1', baseUrl: 'https://x.example/v1' },
      ),
    ).toEqual({
      provider: 'openai-compatible',
      apiKey: 'k',
      model: 'm2',
      baseUrl: 'https://x.example/v1',
    })
  })
})
