export const FEED_VERSION = 1 as const
export const SCHEMA_URL = 'https://unpkg.com/@shipdot/core/schema/v1.json'
export const CONFIG_SCHEMA_URL = 'https://unpkg.com/@shipdot/core/schema/config.json'
export const CONFIG_FILE = 'shipdot.config.json'

export const ENTRY_TYPES = ['new', 'improved', 'fixed'] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

/** Frontmatter keys accepted in an entry file. */
export const ENTRY_KEYS: readonly string[] = [
  'id',
  'date',
  'type',
  'title',
  'target',
  'link',
  'image',
  'pr',
]

export interface EntryTranslation {
  title: string
  html: string
}

export interface FeedEntry {
  id: string
  /** `YYYY-MM-DD` */
  date: string
  type: EntryType
  title: string
  /** Sanitized HTML produced at build time. */
  html: string
  /** CSS selector of the element to put a hotspot on. */
  target?: string
  link?: string
  image?: string
  i18n?: Record<string, EntryTranslation>
}

/** The `shipdot.json` file consumed by the widget. */
export interface Feed {
  $schema?: string
  version: typeof FEED_VERSION
  generatedAt: string
  defaultLocale: string
  entries: FeedEntry[]
}

export type LlmProvider = 'anthropic' | 'openai-compatible'

export interface DraftConfig {
  /** Branch the PRs are merged into. Defaults to the repository default branch. */
  baseBranch?: string
  /** PRs with any of these labels are skipped. */
  ignoreLabels: string[]
  /** Conventional commit types that are never user-facing. */
  excludeTypes: string[]
  /** PR authors (GitHub logins) that are skipped, in addition to every `[bot]` account. */
  excludeAuthors: string[]
}

export interface ShipdotConfig {
  /** Product name, used in `llms.txt`. */
  name?: string
  description?: string
  /** Public URL of the site that serves the feed, used in `llms.txt`. */
  url?: string
  entriesDir: string
  outDir: string
  defaultLocale: string
  locales: string[]
  llm?: { provider?: LlmProvider; model?: string; baseUrl?: string }
  draft: DraftConfig
}

export const DEFAULT_CONFIG: ShipdotConfig = {
  entriesDir: '.shipdot/entries',
  outDir: 'public',
  defaultLocale: 'en',
  locales: ['en'],
  draft: {
    ignoreLabels: ['skip-shipdot'],
    excludeTypes: ['chore', 'ci', 'test', 'docs', 'refactor', 'build', 'style', 'revert'],
    excludeAuthors: ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]'],
  },
}

export interface Diagnostic {
  severity: 'error' | 'warning'
  message: string
  file?: string
  line?: number
  column?: number
}

/** `file:line:col - error: message`, like compilers print it. */
export function formatDiagnostic(d: Diagnostic): string {
  let where = d.file ?? ''
  if (d.file && d.line) where += `:${d.line}:${d.column ?? 1}`
  return `${where ? `${where} - ` : ''}${d.severity}: ${d.message}`
}

const LOCALE_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const ID_RE: RegExp = /^[a-z0-9][a-z0-9._-]*$/i

export function isLocale(value: unknown): value is string {
  return typeof value === 'string' && LOCALE_RE.test(value)
}

/** A real calendar date written as `YYYY-MM-DD`. */
export function isDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DATE_RE.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  )
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/** https URL, or a relative / root-relative path (never `//host` or another scheme). */
export function isImageRef(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.startsWith('//')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value.toLowerCase().startsWith('https:')
  return true
}

/**
 * Picks the best available locale for a list of requested ones (most preferred first).
 * Tries an exact match, then the base language (`pt-BR` → `pt`), then any regional variant.
 */
export function resolveLocale(
  requested: readonly string[],
  available: readonly string[],
  fallback: string,
): string {
  const lower = available.map((l) => l.toLowerCase())
  const base = (l: string) => l.split('-')[0]
  for (const tag of requested) {
    const t = tag.toLowerCase()
    let i = lower.indexOf(t)
    if (i < 0) i = lower.indexOf(base(t) ?? t)
    if (i < 0) i = lower.findIndex((l) => base(l) === base(t))
    if (i >= 0) return available[i] as string
  }
  return fallback
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Validates a parsed `shipdot.json`. Returns human-readable problems (empty when valid). */
export function validateFeed(feed: unknown): string[] {
  const problems: string[] = []
  if (!isObject(feed)) return ['feed: must be an object']
  if (feed.version !== FEED_VERSION) problems.push(`version: must be ${FEED_VERSION}`)
  if (typeof feed.generatedAt !== 'string' || Number.isNaN(Date.parse(feed.generatedAt)))
    problems.push('generatedAt: must be an ISO date-time')
  if (!isLocale(feed.defaultLocale)) problems.push('defaultLocale: must be a locale tag')
  if (!Array.isArray(feed.entries)) return [...problems, 'entries: must be an array']
  const ids = new Set<string>()
  feed.entries.forEach((entry: unknown, i) => {
    const at = `entries[${i}]`
    if (!isObject(entry)) {
      problems.push(`${at}: must be an object`)
      return
    }
    if (typeof entry.id !== 'string' || !ID_RE.test(entry.id))
      problems.push(`${at}.id: must match ${ID_RE}`)
    else if (ids.has(entry.id)) problems.push(`${at}.id: duplicate id "${entry.id}"`)
    else ids.add(entry.id)
    if (!isDate(entry.date)) problems.push(`${at}.date: must be YYYY-MM-DD`)
    if (!ENTRY_TYPES.includes(entry.type as EntryType))
      problems.push(`${at}.type: must be one of ${ENTRY_TYPES.join(', ')}`)
    if (typeof entry.title !== 'string' || !entry.title.trim())
      problems.push(`${at}.title: must be a non-empty string`)
    if (typeof entry.html !== 'string') problems.push(`${at}.html: must be a string`)
    if (entry.target !== undefined && (typeof entry.target !== 'string' || !entry.target.trim()))
      problems.push(`${at}.target: must be a non-empty CSS selector`)
    if (entry.link !== undefined && !isHttpUrl(entry.link))
      problems.push(`${at}.link: must be an http(s) URL`)
    if (entry.image !== undefined && !isImageRef(entry.image))
      problems.push(`${at}.image: must be an https URL or a relative path`)
    if (entry.i18n !== undefined) {
      if (!isObject(entry.i18n)) problems.push(`${at}.i18n: must be an object`)
      else
        for (const [locale, t] of Object.entries(entry.i18n)) {
          if (!isLocale(locale)) problems.push(`${at}.i18n: "${locale}" is not a locale tag`)
          if (!isObject(t) || typeof t.title !== 'string' || typeof t.html !== 'string')
            problems.push(`${at}.i18n.${locale}: must have string "title" and "html"`)
        }
    }
  })
  return problems
}

const CONFIG_KEYS = [
  '$schema',
  'name',
  'description',
  'url',
  'entriesDir',
  'outDir',
  'defaultLocale',
  'locales',
  'llm',
  'draft',
]

/** Merges a parsed `shipdot.config.json` with defaults and reports problems. */
export function resolveConfig(input: unknown): { config: ShipdotConfig; problems: string[] } {
  const problems: string[] = []
  const raw = input ?? {}
  if (!isObject(raw)) return { config: DEFAULT_CONFIG, problems: ['config: must be an object'] }
  for (const key of Object.keys(raw))
    if (!CONFIG_KEYS.includes(key)) problems.push(`${key}: unknown option`)
  for (const key of ['name', 'description', 'entriesDir', 'outDir'] as const)
    if (raw[key] !== undefined && typeof raw[key] !== 'string')
      problems.push(`${key}: must be a string`)
  if (raw.url !== undefined && !isHttpUrl(raw.url)) problems.push('url: must be an http(s) URL')
  if (raw.defaultLocale !== undefined && !isLocale(raw.defaultLocale))
    problems.push('defaultLocale: must be a locale tag like "en" or "pt-BR"')
  if (raw.locales !== undefined && !(isStringArray(raw.locales) && raw.locales.every(isLocale)))
    problems.push('locales: must be an array of locale tags')

  const draft = isObject(raw.draft) ? raw.draft : {}
  if (raw.draft !== undefined && !isObject(raw.draft)) problems.push('draft: must be an object')
  for (const key of ['ignoreLabels', 'excludeTypes', 'excludeAuthors'] as const)
    if (draft[key] !== undefined && !isStringArray(draft[key]))
      problems.push(`draft.${key}: must be an array of strings`)
  if (draft.baseBranch !== undefined && typeof draft.baseBranch !== 'string')
    problems.push('draft.baseBranch: must be a string')

  const llm = isObject(raw.llm) ? raw.llm : undefined
  if (raw.llm !== undefined && !llm) problems.push('llm: must be an object')
  if (
    llm?.provider !== undefined &&
    !['anthropic', 'openai-compatible'].includes(llm.provider as string)
  )
    problems.push('llm.provider: must be "anthropic" or "openai-compatible"')

  const pick = <T>(value: unknown, fallback: T, ok: (v: unknown) => boolean): T =>
    value !== undefined && ok(value) ? (value as T) : fallback
  const isString = (v: unknown) => typeof v === 'string'
  const defaultLocale = pick(raw.defaultLocale, DEFAULT_CONFIG.defaultLocale, isLocale)
  const locales = pick<string[]>(
    raw.locales,
    [defaultLocale],
    (v) => isStringArray(v) && v.every(isLocale),
  )
  const d = DEFAULT_CONFIG.draft
  const config: ShipdotConfig = {
    entriesDir: pick(raw.entriesDir, DEFAULT_CONFIG.entriesDir, isString),
    outDir: pick(raw.outDir, DEFAULT_CONFIG.outDir, isString),
    defaultLocale,
    locales: locales.includes(defaultLocale) ? locales : [defaultLocale, ...locales],
    draft: {
      ignoreLabels: pick(draft.ignoreLabels, d.ignoreLabels, isStringArray),
      excludeTypes: pick(draft.excludeTypes, d.excludeTypes, isStringArray),
      excludeAuthors: pick(draft.excludeAuthors, d.excludeAuthors, isStringArray),
    },
  }
  if (typeof draft.baseBranch === 'string') config.draft.baseBranch = draft.baseBranch
  if (typeof raw.name === 'string') config.name = raw.name
  if (typeof raw.description === 'string') config.description = raw.description
  if (isHttpUrl(raw.url)) config.url = raw.url
  if (llm) {
    config.llm = {}
    if (typeof llm.provider === 'string') config.llm.provider = llm.provider as LlmProvider
    if (typeof llm.model === 'string') config.llm.model = llm.model
    if (typeof llm.baseUrl === 'string') config.llm.baseUrl = llm.baseUrl
  }
  return { config, problems }
}
