import { relative, resolve, sep } from 'node:path'
import { ENTRY_TYPES, type EntryType } from '@shipdot/core'
import { parseEntryFile, serializeEntry, stripHtmlComments } from '@shipdot/core/compile'
import type { GitHub, PullRequest } from './github'
import { type LlmOptions, rewriteWithLlm } from './llm'
import { type Project, readEntries } from './project'

export const DRAFT_BRANCH_PREFIX = 'shipdot/draft-'

export interface ShipdotSection {
  skip: boolean
  title?: string
  type?: EntryType
  target?: string
  link?: string
  body: string
}

const unquote = (value: string) =>
  value
    .trim()
    .replace(/^(["'`])(.*)\1$/, '$2')
    .trim()

// A Markdown thematic break (`---`, `***`, `___`, spaces allowed). Each repetition starts with
// the marker character, so the pattern cannot backtrack polynomially.
const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/

/**
 * Reads the `### shipdot` section of a pull request body. Leading `title:`, `type:`,
 * `target:` and `link:` lines are metadata; the rest is the note. The section ends at the
 * next heading of the same or a higher level, or at a horizontal rule (`---`), where tools
 * usually append their footers. A section that says `skip` opts the pull request out.
 * Returns undefined when there is no (filled) section.
 */
export function parseShipdotSection(body: string | null | undefined): ShipdotSection | undefined {
  if (!body) return undefined
  // PR bodies are untrusted: these patterns must not backtrack polynomially (no two adjacent
  // quantifiers that can match the same characters).
  const text = stripHtmlComments(body.replace(/\r\n?/g, '\n'))
  const heading = /^(#{1,6})[ \t]+shipdot[ \t#]*$/im.exec(text)
  if (!heading) return undefined
  const rest = text.slice(heading.index + heading[0].length)
  const next = new RegExp(`^#{1,${heading[1]?.length}}[ \\t]`, 'm').exec(rest)
  const all = (next ? rest.slice(0, next.index) : rest).split('\n')
  const rule = all.findIndex((line) => THEMATIC_BREAK_RE.test(line))
  const lines = (rule === -1 ? all : all.slice(0, rule)).join('\n').trim().split('\n')
  if (!lines[0]?.trim()) return undefined
  if (/^skip\.?$/i.test(lines[0].trim())) return { skip: true, body: '' }

  const section: ShipdotSection = { skip: false, body: '' }
  let i = 0
  for (; i < lines.length; i++) {
    const match = /^(title|type|target|link)[ \t]*:(.*)$/i.exec(lines[i] ?? '')
    if (!match) break
    const key = match[1]?.toLowerCase() as 'title' | 'type' | 'target' | 'link'
    const value = unquote(match[2] ?? '')
    if (!value) continue
    if (key === 'type') {
      if (ENTRY_TYPES.includes(value.toLowerCase() as EntryType))
        section.type = value.toLowerCase() as EntryType
    } else section[key] = value
  }
  section.body = lines.slice(i).join('\n').trim()
  return section
}

// `\s*(\S.*)` instead of `\s*(.+)`: the subject must start where the whitespace ends, so a
// title with many spaces cannot backtrack polynomially.
const CONVENTIONAL_RE = /^(\w+)(?:\([^)]*\))?!?:\s*(\S.*)$/

/** The conventional commit type of a title (`feat(ui): x` → `feat`), lowercased. */
export function conventionalType(title: string): string | undefined {
  return CONVENTIONAL_RE.exec(title.trim())?.[1]?.toLowerCase()
}

/** `feat(export): add excel export (#12)` → `Add excel export` */
export function titleFromPr(title: string): string {
  const subject = CONVENTIONAL_RE.exec(title.trim())?.[2] ?? title
  const clean = subject
    .trim()
    .replace(/\(#\d+\)$/, '')
    .trim()
    .replace(/\.$/, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export function typeFromPr(title: string): EntryType {
  const type = conventionalType(title)
  if (type === 'feat') return 'new'
  if (type === 'fix') return 'fixed'
  return 'improved'
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'update'
  )
}

export interface DraftOptions {
  project: Project
  github: GitHub
  /** Defaults to `draft.baseBranch` or the repository default branch. */
  base?: string | undefined
  /** `YYYY-MM-DD` or an ISO date-time. Defaults to the latest tag, then the latest entry. */
  since?: string | undefined
  limit?: number | undefined
  llm?: LlmOptions | undefined
  log?: (message: string) => void
}

export interface DraftedFile {
  /** POSIX path relative to the project root. */
  path: string
  content: string
}

export interface DraftResult {
  repo: string
  base: string
  since: { date: string; source: 'option' | 'tag' | 'entry'; ref?: string } | undefined
  files: DraftedFile[]
  drafted: { number: number; title: string; url: string; path: string; mode: 'template' | 'llm' }[]
  skipped: { number: number; title: string; reason: string }[]
}

/** Why a pull request should not get an entry, or undefined if it should. */
export function skipReason(
  pr: PullRequest,
  section: ShipdotSection | undefined,
  project: Project,
  existing: ReadonlySet<number>,
): string | undefined {
  const { draft } = project.config
  if (pr.head.ref.startsWith(DRAFT_BRANCH_PREFIX)) return 'shipdot draft pull request'
  if (existing.has(pr.number)) return 'already has an entry'
  const login = pr.user?.login ?? ''
  if (pr.user?.type === 'Bot' || login.endsWith('[bot]') || draft.excludeAuthors.includes(login))
    return `bot author (${login})`
  const label = pr.labels.find((l) => draft.ignoreLabels.includes(l.name))
  if (label) return `label "${label.name}"`
  if (section?.skip) return '"skip" in the ### shipdot section'
  const type = conventionalType(pr.title)
  if (!section && type && draft.excludeTypes.includes(type)) return `type "${type}"`
  return undefined
}

/** Drafts entry files for pull requests merged since the last release. Writes nothing. */
export async function draftEntries(options: DraftOptions): Promise<DraftResult> {
  const { project, github } = options
  const { config } = project
  const log = options.log ?? (() => {})
  const entriesDir = relative(project.root, resolve(project.root, config.entriesDir))
    .split(sep)
    .join('/')

  const existing = new Set<number>()
  const paths = new Set<string>()
  let latestEntry: string | undefined
  for (const file of await readEntries(project)) {
    paths.add(file.path)
    const { data } = parseEntryFile(file)
    if (typeof data.pr === 'number') existing.add(data.pr)
    if (typeof data.date === 'string' && (!latestEntry || data.date > latestEntry))
      latestEntry = data.date
  }

  const base = options.base ?? config.draft.baseBranch ?? (await github.defaultBranch())
  let since: DraftResult['since']
  if (options.since) since = { date: options.since, source: 'option' }
  else {
    const tag = github.authenticated ? await github.latestTag().catch(() => undefined) : undefined
    if (tag) since = { date: tag.date, source: 'tag', ref: tag.name }
    else if (latestEntry) since = { date: latestEntry, source: 'entry' }
  }
  const sinceDate = since ? new Date(since.date) : undefined
  if (sinceDate && Number.isNaN(sinceDate.getTime()))
    throw new Error(`invalid date: ${since?.date}`)

  const pulls = (await github.mergedPulls(base, sinceDate, options.limit ?? 50)).reverse()
  const result: DraftResult = {
    repo: github.repo,
    base,
    since,
    files: [],
    drafted: [],
    skipped: [],
  }
  const translateTo = config.locales.filter((l) => l !== config.defaultLocale)

  for (const pr of pulls) {
    const section = parseShipdotSection(pr.body)
    const reason = skipReason(pr, section, project, existing)
    if (reason) {
      result.skipped.push({ number: pr.number, title: pr.title, reason })
      continue
    }
    let mode: 'template' | 'llm' = 'template'
    let type = section?.type ?? typeFromPr(pr.title)
    let title = section?.title ?? titleFromPr(pr.title)
    let body = section?.body ?? ''
    let translations: Record<string, { title: string; body: string }> = {}
    // A human-written ### shipdot section always wins; the LLM only handles the rest.
    if (options.llm && !section) {
      try {
        const note = await rewriteWithLlm(
          pr,
          { locale: config.defaultLocale, translateTo },
          options.llm,
        )
        if (note.skip) {
          result.skipped.push({
            number: pr.number,
            title: pr.title,
            reason: 'LLM: not user-facing',
          })
          continue
        }
        ;({ type, title, body, translations } = note)
        mode = 'llm'
      } catch (error) {
        log(`#${pr.number}: LLM rewrite failed (${(error as Error).message}), using template mode`)
      }
    }

    const date = (pr.merged_at ?? pr.updated_at).slice(0, 10)
    let stem = `${date}-${slugify(title)}`
    if (paths.has(`${stem}.md`)) stem = `${stem}-${pr.number}`
    paths.add(`${stem}.md`)
    const path = `${entriesDir}/${stem}.md`
    result.files.push({
      path,
      content: serializeEntry(
        { date, type, title, target: section?.target, link: section?.link, pr: pr.number },
        body,
      ),
    })
    for (const [locale, t] of Object.entries(translations))
      result.files.push({
        path: `${entriesDir}/${stem}.${locale}.md`,
        content: serializeEntry({ title: t.title }, t.body),
      })
    result.drafted.push({ number: pr.number, title, url: pr.html_url, path, mode })
  }
  return result
}
