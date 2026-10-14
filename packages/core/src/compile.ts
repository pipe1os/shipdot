import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { isMap, isScalar, LineCounter, parseDocument, stringify } from 'yaml'
import {
  CONFIG_FILE,
  type Diagnostic,
  ENTRY_KEYS,
  ENTRY_TYPES,
  type EntryType,
  FEED_VERSION,
  type Feed,
  type FeedEntry,
  ID_RE,
  isDate,
  isHttpUrl,
  isImageRef,
  isLocale,
  SCHEMA_URL,
} from './index'

/** An entry file. `path` is POSIX and relative to the entries directory. */
export interface SourceFile {
  path: string
  content: string
}

export interface CompileOptions {
  defaultLocale: string
  locales: readonly string[]
  /** ISO date-time; defaults to now. */
  generatedAt?: string
  /** Used for `llms.txt`. */
  name?: string
  description?: string
  url?: string
}

/** A relative image referenced by an entry that must be copied next to `shipdot.json`. */
export interface Asset {
  /** POSIX path relative to the entries directory. */
  from: string
  /** POSIX path relative to the output directory. */
  to: string
}

export interface CompileResult {
  ok: boolean
  feed: Feed
  diagnostics: Diagnostic[]
  assets: Asset[]
  llms: string
  llmsFull: string
}

export interface ParsedEntryFile {
  data: Record<string, unknown>
  body: string
  /** 1-based position of each frontmatter key in the file. */
  positions: Record<string, { line: number; column: number }>
  diagnostics: Diagnostic[]
}

export const ASSETS_DIR = 'shipdot-assets'

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/

export function parseEntryFile(file: SourceFile): ParsedEntryFile {
  const match = FRONTMATTER_RE.exec(file.content)
  if (!match) {
    return {
      data: {},
      body: file.content,
      positions: {},
      diagnostics: [
        {
          severity: 'error',
          file: file.path,
          line: 1,
          column: 1,
          message: 'missing frontmatter: the file must start with a "---" block',
        },
      ],
    }
  }
  const diagnostics: Diagnostic[] = []
  const lineCounter = new LineCounter()
  const doc = parseDocument(match[1] ?? '', { lineCounter })
  for (const error of doc.errors) {
    diagnostics.push({
      severity: 'error',
      file: file.path,
      // +1: the opening "---" line.
      line: (error.linePos?.[0].line ?? 0) + 1,
      column: error.linePos?.[0].col ?? 1,
      message: `invalid YAML: ${error.message.split('\n')[0]}`,
    })
  }
  const positions: ParsedEntryFile['positions'] = {}
  if (isMap(doc.contents)) {
    for (const pair of doc.contents.items) {
      if (isScalar(pair.key) && pair.key.range) {
        const pos = lineCounter.linePos(pair.key.range[0])
        positions[String(pair.key.value)] = { line: pos.line + 1, column: pos.col }
      }
    }
  }
  const value: unknown = doc.errors.length ? {} : (doc.toJS() ?? {})
  const isMapping = typeof value === 'object' && value !== null && !Array.isArray(value)
  if (!isMapping) {
    diagnostics.push({
      severity: 'error',
      file: file.path,
      line: 2,
      column: 1,
      message: 'frontmatter must be a mapping of keys to values',
    })
  }
  return {
    data: isMapping ? (value as Record<string, unknown>) : {},
    body: file.content.slice(match[0].length),
    positions,
    diagnostics,
  }
}

/** Writes an entry file (frontmatter + Markdown body). */
export function serializeEntry(data: Record<string, unknown>, body: string): string {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  const text = body.trim()
  return `---\n${stringify(clean, { lineWidth: 0 })}---\n${text ? `${text}\n` : ''}`
}

// Markdown → HTML ---------------------------------------------------------------------------

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
  alt?: string
}

const walk = (node: HastNode, visit: (node: HastNode) => void): void => {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

/** The allowlist. Anything else is removed (its text content is kept). */
const SANITIZE_SCHEMA: SanitizeSchema = {
  tagNames: ['p', 'a', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'br', 'h3', 'h4', 'img'],
  attributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'], ol: ['start'] },
  protocols: { href: ['http', 'https', 'mailto'], src: ['https'] },
  strip: ['script', 'style'],
  clobberPrefix: '',
  clobber: [],
  ancestors: {},
  required: {},
}

const demoteHeadings = () => (tree: HastNode) =>
  walk(tree, (node) => {
    if (node.tagName === 'h1' || node.tagName === 'h2') node.tagName = 'h3'
    else if (node.tagName === 'h5' || node.tagName === 'h6') node.tagName = 'h4'
  })

const finalize = (rewriteImage?: (src: string) => string) => (tree: HastNode) =>
  walk(tree, (node) => {
    const props = node.properties
    if (!props) return
    if (node.tagName === 'a' && typeof props.href === 'string') {
      const href = props.href.startsWith('//') ? `https:${props.href}` : props.href
      props.href = href
      if (/^https?:/i.test(href)) {
        props.target = '_blank'
        props.rel = ['noopener', 'noreferrer']
      }
    }
    if (node.tagName === 'img') {
      let src = props.src
      if (typeof src === 'string' && src.startsWith('//')) src = `https:${src}`
      if (typeof src === 'string' && rewriteImage && !/^(https:|\/)/i.test(src))
        src = rewriteImage(src)
      props.src = src
      props.loading = 'lazy'
    }
  })

/**
 * Renders Markdown to sanitized HTML. Raw HTML in the Markdown is dropped, `#`/`##` become
 * `<h3>`, links open in a new tab, and only the allowlisted tags and URL schemes survive.
 */
export function renderMarkdown(markdown: string, rewriteImage?: (src: string) => string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(demoteHeadings)
      .use(rehypeSanitize, SANITIZE_SCHEMA)
      .use(finalize, rewriteImage)
      .use(rehypeStringify)
      .processSync(markdown),
  )
}

interface MdastNode {
  type: string
  value?: string
  alt?: string
  children?: MdastNode[]
}

const mdText = (node: MdastNode): string =>
  node.value ?? node.alt ?? (node.children ?? []).map(mdText).join('')

/** Plain text of the first paragraph, for one-line summaries. */
export function summarize(markdown: string, max = 200): string {
  const tree = unified().use(remarkParse).parse(markdown) as MdastNode
  const paragraph = tree.children?.find((n) => n.type === 'paragraph')
  const text = paragraph ? mdText(paragraph).replace(/\s+/g, ' ').trim() : ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

// Paths --------------------------------------------------------------------------------------

/** Joins and normalizes POSIX paths. Returns undefined if the result escapes the root. */
const resolvePath = (dir: string, ref: string): string | undefined => {
  const out: string[] = []
  for (const part of `${dir}/${ref.split(/[?#]/)[0]}`.split('/')) {
    if (part === '..') {
      if (!out.length) return undefined
      out.pop()
    } else if (part && part !== '.') out.push(decodeURIComponent(part))
  }
  return out.join('/')
}

const dirname = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// Compile -----------------------------------------------------------------------------------

interface Compiled {
  entry: FeedEntry
  markdown: string
}

/** Validates entry files and compiles them into a feed plus `llms.txt` / `llms-full.txt`. */
export function compile(files: readonly SourceFile[], options: CompileOptions): CompileResult {
  const diagnostics: Diagnostic[] = []
  const assets = new Map<string, Asset>()
  const locales = new Set(options.locales)
  const sources = files
    .filter((f) => f.path.endsWith('.md'))
    .sort((a, b) => (a.path < b.path ? -1 : 1))
  const paths = new Set(sources.map((f) => f.path))

  const bases: SourceFile[] = []
  const translations: { file: SourceFile; locale: string; basePath: string }[] = []
  for (const file of sources) {
    const stem = file.path.slice(0, -3)
    const dot = stem.lastIndexOf('.')
    const suffix = dot > stem.lastIndexOf('/') ? stem.slice(dot + 1) : ''
    const basePath = `${stem.slice(0, dot)}.md`
    if (isLocale(suffix) && (locales.has(suffix) || paths.has(basePath)))
      translations.push({ file, locale: suffix, basePath })
    else bases.push(file)
  }

  const imageRewriter = (file: SourceFile, report: (message: string) => void) => (src: string) => {
    const from = resolvePath(dirname(file.path), src)
    if (from === undefined) {
      report(`image "${src}" points outside the entries directory`)
      return src
    }
    const to = `${ASSETS_DIR}/${from}`
    assets.set(from, { from, to })
    return to
  }

  const byPath = new Map<string, Compiled>()
  const ids = new Map<string, string>()
  for (const file of bases) {
    const parsed = parseEntryFile(file)
    diagnostics.push(...parsed.diagnostics)
    if (parsed.diagnostics.length) continue
    const { data, positions } = parsed
    let failed = false
    const report = (severity: Diagnostic['severity'], key: string | undefined, message: string) => {
      if (severity === 'error') failed = true
      const pos = (key && positions[key]) || { line: 1, column: 1 }
      diagnostics.push({ severity, file: file.path, ...pos, message })
    }
    const error = (key: string | undefined, message: string) => report('error', key, message)

    for (const key of Object.keys(data))
      if (!ENTRY_KEYS.includes(key))
        report(
          'warning',
          key,
          `unknown key "${key}" is ignored (allowed: ${ENTRY_KEYS.join(', ')})`,
        )

    const id = data.id ?? basename(file.path).slice(0, -3)
    if (typeof id !== 'string' || !ID_RE.test(id))
      error('id', `invalid id ${JSON.stringify(id)}: use letters, digits, ".", "_" and "-"`)
    else if (ids.has(id)) error('id', `duplicate id "${id}" (already used by ${ids.get(id)})`)
    else ids.set(id, file.path)

    if (data.date === undefined) error(undefined, 'missing required key "date" (YYYY-MM-DD)')
    else if (!isDate(data.date))
      error('date', `invalid date ${JSON.stringify(data.date)}: use a real date as YYYY-MM-DD`)

    if (data.type === undefined)
      error(undefined, `missing required key "type" (${ENTRY_TYPES.join(' | ')})`)
    else if (!ENTRY_TYPES.includes(data.type as EntryType))
      error('type', `unknown type ${JSON.stringify(data.type)}: use ${ENTRY_TYPES.join(' | ')}`)

    if (data.title === undefined) error(undefined, 'missing required key "title"')
    else if (typeof data.title !== 'string' || !data.title.trim())
      error('title', '"title" must be a non-empty string')

    if (data.target !== undefined && (typeof data.target !== 'string' || !data.target.trim()))
      error('target', '"target" must be a CSS selector string, like "#btn-export"')
    if (data.link !== undefined && !isHttpUrl(data.link))
      error('link', '"link" must be an http(s) URL')
    if (data.image !== undefined && !isImageRef(data.image))
      error('image', '"image" must be an https URL or a relative path')
    if (data.pr !== undefined && !(Number.isInteger(data.pr) && (data.pr as number) > 0))
      error('pr', '"pr" must be a pull request number')
    if (failed) continue

    const rewrite = imageRewriter(file, (message) => error('image', message))
    const entry: FeedEntry = {
      id: id as string,
      date: data.date as string,
      type: data.type as EntryType,
      title: (data.title as string).trim(),
      html: renderMarkdown(parsed.body, rewrite),
    }
    if (typeof data.target === 'string') entry.target = data.target.trim()
    if (typeof data.link === 'string') entry.link = data.link
    if (typeof data.image === 'string')
      entry.image = /^(https:|\/)/i.test(data.image) ? data.image : rewrite(data.image)
    if (!failed) byPath.set(file.path, { entry, markdown: parsed.body })
  }

  for (const { file, locale, basePath } of translations) {
    const at = { file: file.path, line: 1, column: 1 }
    if (!locales.has(locale)) {
      diagnostics.push({
        severity: 'error',
        ...at,
        message: `locale "${locale}" is not declared in ${CONFIG_FILE} "locales" (${[...locales].join(', ')})`,
      })
      continue
    }
    if (locale === options.defaultLocale) {
      diagnostics.push({
        severity: 'error',
        ...at,
        message: `"${locale}" is the default locale: put this content in ${basePath} instead`,
      })
      continue
    }
    if (!paths.has(basePath)) {
      diagnostics.push({
        severity: 'error',
        ...at,
        message: `orphan translation: ${basePath} does not exist`,
      })
      continue
    }
    const base = byPath.get(basePath)
    const parsed = parseEntryFile(file)
    diagnostics.push(...parsed.diagnostics)
    if (!base || parsed.diagnostics.length) continue
    const { data, positions } = parsed
    let failed = false
    const error = (key: string | undefined, message: string) => {
      failed = true
      const pos = (key && positions[key]) || { line: 1, column: 1 }
      diagnostics.push({ severity: 'error', file: file.path, ...pos, message })
    }
    for (const key of Object.keys(data))
      if (key !== 'title' && key !== 'id')
        error(
          key,
          `"${key}" cannot be translated: only "title" and the body can (set it in ${basePath})`,
        )
    if (data.id !== undefined && data.id !== base.entry.id)
      error('id', `id ${JSON.stringify(data.id)} does not match "${base.entry.id}" in ${basePath}`)
    if (typeof data.title !== 'string' || !data.title.trim())
      error('title', 'a translation needs a non-empty "title"')
    if (failed) continue
    const rewrite = imageRewriter(file, (message) => error(undefined, message))
    base.entry.i18n = {
      ...base.entry.i18n,
      [locale]: {
        title: (data.title as string).trim(),
        html: renderMarkdown(parsed.body, rewrite),
      },
    }
  }

  const compiled = [...byPath.values()].sort(
    (a, b) => b.entry.date.localeCompare(a.entry.date) || b.entry.id.localeCompare(a.entry.id),
  )
  const feed: Feed = {
    $schema: SCHEMA_URL,
    version: FEED_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    defaultLocale: options.defaultLocale,
    entries: compiled.map((c) => c.entry),
  }
  return {
    ok: !diagnostics.some((d) => d.severity === 'error'),
    feed,
    diagnostics,
    assets: [...assets.values()],
    llms: toLlmsTxt(compiled, options),
    llmsFull: toLlmsFullTxt(compiled, options),
  }
}

// llms.txt ----------------------------------------------------------------------------------

const TYPE_LABEL: Record<EntryType, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed' }

const llmsHeader = (options: CompileOptions): string => {
  const title = options.name ? `${options.name}: what's new` : "What's new"
  const summary =
    options.description ??
    `Product updates${options.name ? ` for ${options.name}` : ''}, newest first.`
  return `# ${title}\n\n> ${summary.replace(/\s+/g, ' ')}\n`
}

const stripComments = (markdown: string) => markdown.replace(/<!--[\s\S]*?-->/g, '').trim()

function toLlmsTxt(compiled: readonly Compiled[], options: CompileOptions): string {
  const lines = compiled.map(({ entry, markdown }) => {
    const name = entry.link ? `[${entry.title}](${entry.link})` : entry.title
    const summary = summarize(stripComments(markdown))
    return `- ${name}: ${TYPE_LABEL[entry.type]} on ${entry.date}.${summary ? ` ${summary}` : ''}`
  })
  let out = `${llmsHeader(options)}\n## Updates\n\n${lines.join('\n') || '- No updates yet.'}\n`
  if (options.url) {
    const full = new URL(
      'llms-full.txt',
      options.url.endsWith('/') ? options.url : `${options.url}/`,
    )
    out += `\n## Optional\n\n- [Full update notes](${full.href}): every update with its complete text.\n`
  }
  return out
}

function toLlmsFullTxt(compiled: readonly Compiled[], options: CompileOptions): string {
  const sections = compiled.map(({ entry, markdown }) => {
    const meta = [`Date: ${entry.date}`, `Type: ${TYPE_LABEL[entry.type]}`]
    if (entry.link) meta.push(`Link: ${entry.link}`)
    const body = stripComments(markdown)
    return `## ${entry.title}\n\n${meta.join(' · ')}\n${body ? `\n${body}\n` : ''}`
  })
  return `${llmsHeader(options)}\n${sections.join('\n')}`
}
