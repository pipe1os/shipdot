import type { PullRequest } from '@shipdot/cli'

export interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

type Handler = (call: Call) => unknown

/** A fake `fetch` that routes "METHOD url-substring" to handlers and records every call. */
export function mockFetch(routes: Record<string, Handler | unknown>): {
  fetch: typeof fetch
  calls: Call[]
} {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    const key = Object.keys(routes).find((route) => {
      const [method, ...rest] = route.split(' ')
      return method === call.method && call.url.includes(rest.join(' '))
    })
    if (!key) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    const route = routes[key]
    const value = typeof route === 'function' ? (route as Handler)(call) : route
    if (value instanceof Response) return value
    return new Response(JSON.stringify(value), { status: 200 })
  }) as typeof fetch
  return { fetch: fetchImpl, calls }
}

let next = 100

export function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  const number = overrides.number ?? next++
  return {
    number,
    title: 'feat: add something',
    body: null,
    html_url: `https://github.com/acme/app/pull/${number}`,
    merged_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
    user: { login: 'dev', type: 'User' },
    labels: [],
    head: { ref: `feature-${number}` },
    ...overrides,
  }
}
