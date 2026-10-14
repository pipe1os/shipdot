import {
  DEFAULT_CONFIG,
  formatDiagnostic,
  isDate,
  isImageRef,
  resolveConfig,
  resolveLocale,
  validateFeed,
} from '@shipdot/core'
import { describe, expect, it } from 'vitest'

describe('isDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isDate('2026-10-14')).toBe(true)
    expect(isDate('2024-02-29')).toBe(true)
    expect(isDate('2026-02-30')).toBe(false)
    expect(isDate('2026-13-01')).toBe(false)
    expect(isDate('14-10-2026')).toBe(false)
    expect(isDate('2026-10-14T00:00:00Z')).toBe(false)
    expect(isDate(20261014)).toBe(false)
  })
})

describe('isImageRef', () => {
  it('allows https and relative paths', () => {
    expect(isImageRef('https://example.com/a.png')).toBe(true)
    expect(isImageRef('./a.png')).toBe(true)
    expect(isImageRef('img/a.png')).toBe(true)
    expect(isImageRef('/static/a.png')).toBe(true)
  })
  it('rejects other schemes and protocol-relative URLs', () => {
    expect(isImageRef('http://example.com/a.png')).toBe(false)
    expect(isImageRef('data:image/png;base64,AAAA')).toBe(false)
    expect(isImageRef('javascript:alert(1)')).toBe(false)
    expect(isImageRef('//evil.example/a.png')).toBe(false)
  })
})

describe('resolveLocale', () => {
  const available = ['en', 'es', 'pt-BR']
  it('matches exactly, case-insensitively', () => {
    expect(resolveLocale(['ES'], available, 'en')).toBe('es')
    expect(resolveLocale(['pt-br'], available, 'en')).toBe('pt-BR')
  })
  it('falls back to the base language and then to regional variants', () => {
    expect(resolveLocale(['es-CL'], available, 'en')).toBe('es')
    expect(resolveLocale(['pt'], available, 'en')).toBe('pt-BR')
    expect(resolveLocale(['pt-PT'], available, 'en')).toBe('pt-BR')
  })
  it('respects preference order and uses the fallback', () => {
    expect(resolveLocale(['fr', 'es'], available, 'en')).toBe('es')
    expect(resolveLocale(['fr', 'de'], available, 'en')).toBe('en')
    expect(resolveLocale([], available, 'en')).toBe('en')
  })
})

describe('validateFeed', () => {
  const entry = { id: 'a', date: '2026-10-14', type: 'new', title: 'A', html: '<p>a</p>' }
  const feed = {
    version: 1,
    generatedAt: '2026-10-14T21:00:00Z',
    defaultLocale: 'en',
    entries: [entry],
  }

  it('accepts a valid feed', () => {
    expect(validateFeed(feed)).toEqual([])
  })

  it('reports every problem with a path', () => {
    const problems = validateFeed({
      version: 2,
      generatedAt: 'nope',
      defaultLocale: 'english',
      entries: [
        entry,
        { ...entry, type: 'feature', date: '2026-02-31', link: 'javascript:alert(1)' },
        { ...entry, id: 'b', i18n: { es: { title: 'B' } } },
      ],
    })
    expect(problems).toEqual([
      'version: must be 1',
      'generatedAt: must be an ISO date-time',
      'defaultLocale: must be a locale tag',
      'entries[1].id: duplicate id "a"',
      'entries[1].date: must be YYYY-MM-DD',
      'entries[1].type: must be one of new, improved, fixed',
      'entries[1].link: must be an http(s) URL',
      'entries[2].i18n.es: must have string "title" and "html"',
    ])
  })

  it('rejects non-objects', () => {
    expect(validateFeed(null)).toEqual(['feed: must be an object'])
    expect(validateFeed({ ...feed, entries: {} })).toContain('entries: must be an array')
  })
})

describe('resolveConfig', () => {
  it('returns defaults for an empty config', () => {
    expect(resolveConfig({})).toEqual({ config: DEFAULT_CONFIG, problems: [] })
    expect(resolveConfig(undefined).config).toEqual(DEFAULT_CONFIG)
  })

  it('merges values and always includes the default locale', () => {
    const { config, problems } = resolveConfig({
      name: 'Acme',
      defaultLocale: 'es',
      locales: ['en', 'pt'],
      draft: { ignoreLabels: ['no-notes'] },
      llm: { provider: 'anthropic', model: 'some-model' },
    })
    expect(problems).toEqual([])
    expect(config.locales).toEqual(['es', 'en', 'pt'])
    expect(config.draft.ignoreLabels).toEqual(['no-notes'])
    expect(config.draft.excludeTypes).toEqual(DEFAULT_CONFIG.draft.excludeTypes)
    expect(config.llm).toEqual({ provider: 'anthropic', model: 'some-model' })
    expect(config.name).toBe('Acme')
  })

  it('reports invalid and unknown options', () => {
    const { problems } = resolveConfig({
      entriesdir: 'x',
      outDir: 3,
      locales: ['en', 'not a locale'],
      url: 'ftp://x',
      llm: { provider: 'gemini' },
      draft: { excludeTypes: 'chore' },
    })
    expect(problems).toEqual([
      'entriesdir: unknown option',
      'outDir: must be a string',
      'url: must be an http(s) URL',
      'locales: must be an array of locale tags',
      'draft.excludeTypes: must be an array of strings',
      'llm.provider: must be "anthropic" or "openai-compatible"',
    ])
  })
})

describe('formatDiagnostic', () => {
  it('prints file:line:col like a compiler', () => {
    expect(
      formatDiagnostic({ severity: 'error', file: 'a.md', line: 3, column: 1, message: 'bad' }),
    ).toBe('a.md:3:1 - error: bad')
    expect(formatDiagnostic({ severity: 'warning', message: 'hm' })).toBe('warning: hm')
  })
})
