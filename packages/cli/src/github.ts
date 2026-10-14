export interface PullRequest {
  number: number
  title: string
  body: string | null
  html_url: string
  merged_at: string | null
  updated_at: string
  user: { login: string; type: string } | null
  labels: { name: string }[]
  head: { ref: string }
}

export interface GitHubOptions {
  /** `owner/name` */
  repo: string
  token?: string | undefined
  /** Defaults to `GITHUB_API_URL` or https://api.github.com */
  apiUrl?: string | undefined
  fetch?: typeof fetch
}

export class GitHubError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

/** Minimal GitHub REST/GraphQL client on top of `fetch`. Never logs the token. */
export class GitHub {
  readonly repo: string
  readonly #token: string | undefined
  readonly #api: string
  readonly #fetch: typeof fetch

  constructor(options: GitHubOptions) {
    this.repo = options.repo
    this.#token = options.token
    this.#api = (options.apiUrl ?? process.env.GITHUB_API_URL ?? 'https://api.github.com').replace(
      /\/$/,
      '',
    )
    this.#fetch = options.fetch ?? fetch
  }

  get authenticated(): boolean {
    return Boolean(this.#token)
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.#api}${path}`
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'shipdot',
    }
    if (this.#token) headers.authorization = `Bearer ${this.#token}`
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await this.#fetch(url, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ((await res.json()) as { message?: string }).message ?? ''
      } catch {}
      throw new GitHubError(
        res.status,
        `GitHub ${method} ${path} failed: ${res.status} ${detail}`.trim(),
      )
    }
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await this.request<{ data?: T; errors?: { message: string }[] }>(
      'POST',
      '/graphql',
      { query, variables },
    )
    if (res.errors?.length || !res.data)
      throw new GitHubError(
        200,
        `GitHub GraphQL failed: ${res.errors?.map((e) => e.message).join('; ')}`,
      )
    return res.data
  }

  async defaultBranch(): Promise<string> {
    return (await this.request<{ default_branch: string }>('GET', `/repos/${this.repo}`))
      .default_branch
  }

  /** The most recent tag by commit date, or undefined. Needs a token (GraphQL). */
  async latestTag(): Promise<{ name: string; date: string } | undefined> {
    const [owner, name] = this.repo.split('/')
    const data = await this.graphql<{
      repository: {
        refs: {
          nodes: {
            name: string
            target: { committedDate?: string; target?: { committedDate?: string } }
          }[]
        }
      }
    }>(
      `query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          refs(refPrefix: "refs/tags/", first: 1, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
            nodes { name target { ... on Commit { committedDate } ... on Tag { target { ... on Commit { committedDate } } } } }
          }
        }
      }`,
      { owner, name },
    )
    const node = data.repository.refs.nodes[0]
    const date = node?.target.committedDate ?? node?.target.target?.committedDate
    return node && date ? { name: node.name, date } : undefined
  }

  /** Pull requests merged into `base` after `since` (newest first), up to `limit`. */
  async mergedPulls(base: string, since: Date | undefined, limit: number): Promise<PullRequest[]> {
    const out: PullRequest[] = []
    for (let page = 1; page <= 10 && out.length < limit; page++) {
      const query = `state=closed&base=${encodeURIComponent(base)}&sort=updated&direction=desc&per_page=100&page=${page}`
      const pulls = await this.request<PullRequest[]>('GET', `/repos/${this.repo}/pulls?${query}`)
      for (const pr of pulls) {
        if (!pr.merged_at) continue
        if (since && new Date(pr.merged_at) <= since) continue
        out.push(pr)
      }
      const last = pulls.at(-1)
      // Sorted by last update: once a page ends before `since`, nothing older was merged after it.
      if (pulls.length < 100 || (since && last && new Date(last.updated_at) <= since)) break
    }
    return out.sort((a, b) => (b.merged_at ?? '').localeCompare(a.merged_at ?? '')).slice(0, limit)
  }

  /**
   * Creates `branch` from `base` with the given files in one commit and opens a pull request.
   * Uses the Git Data API, so nothing from the pull requests ever reaches a shell.
   */
  async openPullWithFiles(options: {
    base: string
    branch: string
    message: string
    files: { path: string; content: string }[]
    title: string
    body: string
  }): Promise<{ number: number; html_url: string }> {
    const r = `/repos/${this.repo}`
    const ref = await this.request<{ object: { sha: string } }>(
      'GET',
      `${r}/git/ref/heads/${encodeURIComponent(options.base)}`,
    )
    const parent = ref.object.sha
    const commit = await this.request<{ tree: { sha: string } }>(
      'GET',
      `${r}/git/commits/${parent}`,
    )
    const tree = await this.request<{ sha: string }>('POST', `${r}/git/trees`, {
      base_tree: commit.tree.sha,
      tree: options.files.map((f) => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        content: f.content,
      })),
    })
    const created = await this.request<{ sha: string }>('POST', `${r}/git/commits`, {
      message: options.message,
      tree: tree.sha,
      parents: [parent],
    })
    await this.request('POST', `${r}/git/refs`, {
      ref: `refs/heads/${options.branch}`,
      sha: created.sha,
    })
    return this.request('POST', `${r}/pulls`, {
      title: options.title,
      head: options.branch,
      base: options.base,
      body: options.body,
    })
  }

  /** The open pull request for `branch`, if any. */
  async openPullFor(branch: string): Promise<{ number: number; html_url: string } | undefined> {
    const owner = this.repo.split('/')[0]
    const pulls = await this.request<{ number: number; html_url: string }[]>(
      'GET',
      `/repos/${this.repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
    )
    return pulls[0]
  }
}

/** Parses `owner/name` from a GitHub remote URL (https or ssh). */
export function parseRepo(remote: string): string | undefined {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim())
  return match ? `${match[1]}/${match[2]}` : undefined
}
