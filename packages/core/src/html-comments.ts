// HTML comments in Markdown, found without a Markdown parser. Pull request bodies are untrusted,
// and micromark (remark's parser) takes quadratic time on deeply nested lists and block quotes,
// so a 65 KB body could stall `shipdot draft` for minutes. This scanner follows micromark's rules
// for everything that decides whether `<!--` is raw HTML: containers (block quotes, list items,
// lazy lines), code, HTML blocks, link definitions, code spans, autolinks, links and inline HTML.
// Every line, container and inline construct is visited a bounded number of times, so the time
// is roughly linear. Reference links (`[text][label]`) are not resolved, which only matters for
// `<!--` inside the label of a defined reference or inside a link that contains one.

/** Removes the comments from raw HTML: `<!-->` and `<!--->` are empty, unclosed ones run to the end. */
const stripRawComments = (html: string): string => {
  let out = ''
  let from = 0
  for (let at = html.indexOf('<!--'); at !== -1; at = html.indexOf('<!--', from)) {
    out += html.slice(from, at)
    const empty = html.startsWith('>', at + 4) ? 5 : html.startsWith('->', at + 4) ? 6 : 0
    const end = empty ? -1 : html.indexOf('-->', at + 4)
    from = empty ? at + empty : end === -1 ? html.length : end + 3
  }
  return out + html.slice(from)
}

/**
 * Removes HTML comments from Markdown the way GitHub and the widget render it: only raw HTML
 * holds comments, so `<!--` in a code span, a code block or plain text stays, and a comment
 * block that is never closed hides the rest of the document. Linear time.
 */
export function stripHtmlComments(markdown: string): string {
  if (!markdown.includes('<!--')) return markdown
  const html = rawHtml(markdown)
  let out = ''
  let from = 0
  for (let i = 0; i < html.length; i += 2) {
    const start = html[i] as number
    const end = html[i + 1] as number
    out += markdown.slice(from, start) + stripRawComments(markdown.slice(start, end))
    from = end
  }
  return out + markdown.slice(from)
}

const RAW_TAGS = new Set(['pre', 'script', 'style', 'textarea'])
const RAW_END = /<\/(?:pre|script|style|textarea)>/gi
const BLOCK_TAGS = new Set(
  'address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul'.split(
    ' ',
  ),
)
/** What ends HTML blocks of kinds 2–5 (comment, instruction, declaration, CDATA). */
const BLOCK_END = ['', '', '-->', '?>', '>', ']]>']

const isSpace = (c: number) => c === 32 || c === 9
/** Whitespace inside a paragraph, whose lines are joined with "\n". */
const isWs = (c: number) => c === 32 || c === 9 || c === 10
const isDigit = (c: number) => c >= 48 && c <= 57
const isAlpha = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)
const isAlnum = (c: number) => isDigit(c) || isAlpha(c)
const isControl = (c: number) => (c > 0 && c < 32) || c === 127
const isPunct = (c: number) =>
  (c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126)
const isTagChar = (c: number) => c === 45 || isAlnum(c)
const isAttrChar = (c: number) => c === 45 || c === 46 || c === 58 || c === 95 || isAlnum(c)
const isSchemeChar = (c: number) => c === 43 || c === 45 || c === 46 || isAlnum(c)
const isAtext = (c: number) =>
  (c >= 35 && c <= 39) ||
  c === 42 ||
  c === 43 ||
  (c >= 45 && c <= 57) ||
  c === 61 ||
  c === 63 ||
  (c >= 65 && c <= 90) ||
  (c >= 94 && c <= 126)

/** Finds the first match at or after `from`; each pattern is searched once, then bisected. */
function finder(text: string): (pattern: string | RegExp, from: number) => number {
  const found = new Map<string | RegExp, number[]>()
  return (pattern, from) => {
    let at = found.get(pattern)
    if (!at) {
      at = []
      if (typeof pattern !== 'string')
        for (const match of text.matchAll(pattern)) at.push(match.index)
      else
        for (let i = text.indexOf(pattern); i !== -1; i = text.indexOf(pattern, i + 1)) at.push(i)
      found.set(pattern, at)
    }
    let lo = 0
    let hi = at.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((at[mid] as number) < from) lo = mid + 1
      else hi = mid
    }
    return at[lo] ?? -1
  }
}

// Inline content -------------------------------------------------------------------------------

/**
 * Finds raw HTML in the inline content of a paragraph or heading (`text`, its lines joined with
 * "\n"). Returns the HTML as [start, end) pairs and where the text starts after link definitions.
 */
function inlineHtml(text: string, definitions: boolean): { html: number[]; body: number } {
  const n = text.length
  const code = (i: number): number => (i < n ? text.charCodeAt(i) : -1)
  const find = finder(text)
  const html: number[] = []
  const whitespace = (i: number): number => {
    while (isWs(code(i))) i++
    return i
  }

  /** A link destination; `limit` caps unbalanced parentheses. Returns its end or -1. */
  const destination = (i: number, limit: number): number => {
    let c = code(i)
    if (c === 60) {
      for (i++; ; ) {
        c = code(i++)
        if (c === 62) return i
        if (c === -1 || c === 60 || c === 10) return -1
        if (c === 92 && (code(i) === 60 || code(i) === 62 || code(i) === 92)) i++
      }
    }
    if (c === -1 || c === 32 || c === 41 || isControl(c)) return -1
    for (let balance = 0; ; ) {
      c = code(i)
      if (!balance && (c === -1 || c === 41 || isWs(c))) return i
      if (c === 40 && balance < limit) balance++
      else if (c === 41) balance--
      else if (c === -1 || c === 32 || c === 40 || isControl(c)) return -1
      i++
      if (c === 92 && (code(i) === 40 || code(i) === 41 || code(i) === 92)) i++
    }
  }

  // Titles are scanned from increasing positions, so the last scan per closing character
  // answers every later one that starts inside it: no title is read twice.
  const titles = new Map<number, [from: number, end: number]>()
  /** A link title in quotes or parentheses. Returns its end or -1. */
  const title = (i: number): number => {
    const close = code(i) === 40 ? 41 : code(i)
    const from = i + 1
    const last = titles.get(close)
    let end: number
    if (last && last[0] <= from && (last[1] === -1 || from <= last[1])) end = last[1]
    else {
      for (end = from; ; ) {
        const c = code(end)
        if (c === -1) end = -1
        if (c === -1 || c === close) break
        end++
        if (c === 92 && (code(end) === close || code(end) === 92)) end++
      }
      titles.set(close, [from, end])
    }
    return end === -1 ? -1 : end + 1
  }

  /** `(destination "title")` after a link label. Returns its end or -1. */
  const resource = (i: number): number => {
    i = whitespace(i + 1)
    if (code(i) !== 41) {
      i = destination(i, 32)
      if (i === -1) return -1
      if (isWs(code(i))) {
        i = whitespace(i)
        const c = code(i)
        if (c === 34 || c === 39 || c === 40) {
          i = title(i)
          if (i === -1) return -1
          i = whitespace(i)
        }
      }
    }
    return code(i) === 41 ? i + 1 : -1
  }

  const lineEnd = (i: number): number => {
    while (isSpace(code(i))) i++
    return code(i) === -1 || code(i) === 10 ? i : -1
  }
  /** `[label]: destination "title"`. Returns the end of its last line or -1. */
  const definition = (i: number): number => {
    let size = 0
    let seen = false
    for (i++; ; ) {
      const c = code(i)
      if (c === -1 || c === 91 || size > 999) return -1
      if (c === 93) break
      i++
      if (c === 10) continue
      size++
      if (!isSpace(c)) seen = true
      if (c === 92 && (code(i) === 91 || code(i) === 92 || code(i) === 93)) {
        i++
        size++
      }
    }
    if (!seen || code(i + 1) !== 58) return -1
    i = destination(whitespace(i + 2), Number.POSITIVE_INFINITY)
    if (i === -1) return -1
    if (isWs(code(i))) {
      const t = whitespace(i)
      const c = code(t)
      const end = c === 34 || c === 39 || c === 40 ? title(t) : -1
      const stop = end === -1 ? -1 : lineEnd(end)
      if (stop !== -1) return stop
    }
    return lineEnd(i)
  }

  /** `<scheme:...>` or `<user@example.com>`. Returns its end or 0. */
  const autolink = (i: number): number => {
    let j = i + 1
    let c = code(j)
    if (isAlpha(c)) {
      c = code(++j)
      // A scheme of 2 to 32 characters, or the start of an email address.
      if (isSchemeChar(c))
        for (let size = 1; ; size++) {
          if (c === 58)
            for (j++; ; j++) {
              c = code(j)
              if (c === 62) return j + 1
              if (c === -1 || c === 32 || c === 60 || isControl(c)) return 0
            }
          if (!isSchemeChar(c) || size >= 32) break
          c = code(++j)
        }
    } else if (c === 64) return 0
    while (isAtext(code(j))) j++
    if (code(j++) !== 64) return 0
    // Domain labels: alphanumerics and inner dashes, at most 63 each, separated by dots.
    // States: 0 at the start of a label, 1 after an alphanumeric, 2 after a dash.
    for (let size = 0, state = 0; ; j++) {
      c = code(j)
      if (state === 0 && !isAlnum(c)) return 0
      if (state === 1 && c === 46) {
        size = 0
        state = 0
        continue
      }
      if (state === 1 && c === 62) return j + 1
      if (!(c === 45 || isAlnum(c)) || size++ >= 63) return 0
      state = c === 45 ? 2 : 1
    }
  }

  const after = (pattern: string, from: number): number => {
    const at = find(pattern, from)
    return at === -1 ? 0 : at + pattern.length
  }
  /** A comment, tag, instruction, declaration or CDATA section. Returns its end or 0. */
  const htmlText = (i: number): number => {
    let c = code(i + 1)
    if (c === 33) {
      c = code(i + 2)
      if (c === 45) return code(i + 3) === 45 ? after('-->', i + 2) : 0
      if (c === 91) return text.startsWith('CDATA[', i + 3) ? after(']]>', i + 9) : 0
      return isAlpha(c) ? after('>', i + 3) : 0
    }
    if (c === 63) return after('?>', i + 2)
    let j = i + 2
    if (c === 47) {
      if (!isAlpha(code(j))) return 0
      while (isTagChar(code(++j)));
      j = whitespace(j)
      return code(j) === 62 ? j + 1 : 0
    }
    if (!isAlpha(c)) return 0
    while (isTagChar(code(j))) j++
    c = code(j)
    if (c !== 47 && c !== 62 && !isWs(c)) return 0
    for (;;) {
      c = code(j)
      if (c === 47) return code(j + 1) === 62 ? j + 2 : 0
      if (isWs(c)) j++
      else if (c === 58 || c === 95 || isAlpha(c)) {
        while (isAttrChar(code(++j)));
        j = whitespace(j)
        if (code(j) !== 61) continue
        j = whitespace(j + 1)
        c = code(j)
        if (c === 34 || c === 39) {
          const close = find(c === 34 ? '"' : "'", j + 1)
          if (close === -1) return 0
          j = close + 1
          c = code(j)
          if (c !== 47 && c !== 62 && !isWs(c)) return 0
        } else {
          if (c === -1 || c === 60 || c === 61 || c === 62 || c === 96) return 0
          for (j++; ; j++) {
            c = code(j)
            if (c === 47 || c === 62 || isWs(c)) break
            if (c === -1 || c === 34 || c === 39 || c === 60 || c === 61 || c === 96) return 0
          }
        }
      } else return c === 62 ? j + 1 : 0
    }
  }

  let i = 0
  if (definitions)
    for (;;) {
      while (isSpace(code(i))) i++
      const end = code(i) === 91 ? definition(i) : -1
      if (end === -1) break
      i = end + 1
    }
  const body = Math.min(i, n)

  // Backtick runs by length; a code span closes at the next run of the same length.
  const runs = new Map<number, { at: number[]; next: number }>()
  for (let j = body; j < n; j++) {
    if (text.charCodeAt(j) !== 96) continue
    const start = j
    while (text.charCodeAt(j + 1) === 96) j++
    const size = j + 1 - start
    const list = runs.get(size)
    if (list) list.at.push(start)
    else runs.set(size, { at: [start], next: 0 })
  }
  const closer = (size: number, from: number): number => {
    const list = runs.get(size)
    if (!list) return -1
    while (list.next < list.at.length && (list.at[list.next] as number) < from) list.next++
    return list.at[list.next] ?? -1
  }

  // Open labels: -1 for a link, the HTML found so far for an image. Links cannot contain links,
  // so a link turns the link labels below it inactive.
  const labels: number[] = []
  let active = 0
  for (i = body; i < n; ) {
    const c = text.charCodeAt(i)
    if (c === 92) i += isPunct(code(i + 1)) ? 2 : 1
    else if (c === 96) {
      let end = i + 1
      while (code(end) === 96) end++
      const close = closer(end - i, end)
      i = close === -1 ? end : close + end - i
    } else if (c === 60) {
      const link = autolink(i)
      const tag = link ? 0 : htmlText(i)
      if (tag) html.push(i, tag)
      i = link || tag || i + 1
    } else if (c === 91 || (c === 33 && code(i + 1) === 91)) {
      labels.push(c === 33 ? html.length : -1)
      i += c === 33 ? 2 : 1
    } else if (c === 93) {
      i++
      const label = labels.pop()
      if (label === undefined) continue
      const live = label !== -1 || labels.length >= active
      active = Math.min(active, labels.length)
      const end = live && code(i) === 40 ? resource(i) : -1
      if (end === -1) continue
      i = end
      // An image label is plain alt text to remark, so any HTML in it stays.
      if (label !== -1) html.length = label
      else active = labels.length
    } else i++
  }
  return { html, body }
}

// Blocks ---------------------------------------------------------------------------------------

/** An open block quote, or a list with the content offset of its current item. */
interface Container {
  quote: boolean
  index: number
  ordered: boolean
  marker: number
  /** Columns of indentation that continue the current item. */
  size: number
  /** The item started with a blank line and has no content yet. */
  blankStart: boolean
  /** A blank line followed `blankStart`, so the item cannot continue. */
  furtherBlank: boolean
}

const container = (quote: boolean, ordered = false, marker = 0): Container => ({
  quote,
  index: -1,
  ordered,
  marker,
  size: 0,
  blankStart: false,
  furtherBlank: false,
})

// Leaf blocks that can span lines.
const NONE = 0
const PARAGRAPH = 1
const INDENTED = 2
const FENCED = 3
const HTML = 4

/** Raw HTML in Markdown as [start, end) pairs, in order. */
function rawHtml(md: string): number[] {
  const ranges: number[] = []
  const find = finder(md)
  const stack: Container[] = []
  /** Indices of the block quotes in `stack`. */
  const quotes: number[] = []
  /** The only container that can have `blankStart` set: the item opened last. */
  let blankItem: Container | undefined

  let leaf = NONE
  let paragraph: number[] = []
  let fenceChar = 0
  let fenceSize = 0
  let htmlKind = 0
  let htmlFrom = 0
  let htmlStart = 0
  let htmlEnd = 0
  /** A lone tag interrupted a paragraph on the previous (lazy) line. */
  let pending = false

  // The current line, and the position and column (tabs stop every 4) being read.
  let lineStart = 0
  let lineEnd = 0
  let lastText = 0
  let pos = 0
  let col = 0
  // Caches that keep per-line work linear: the whitespace run around `pos`, and the end of a
  // thematic break that failed.
  let wsFrom = -1
  let wsEnd = 0
  let wsEndCol = 0
  let breakChar = 0
  let breakStop = -1

  const char = (): number => (pos < lineEnd ? md.charCodeAt(pos) : -1)
  const blank = () => lastText < pos
  /** Columns of whitespace from `pos`. */
  const indent = (): number => {
    if (wsFrom === -1 || pos < wsFrom || pos > wsEnd) {
      let p = pos
      let c = col
      for (; p < lineEnd; p++) {
        const ch = md.charCodeAt(p)
        if (ch === 32) c++
        else if (ch === 9) c += 4 - (c % 4)
        else break
      }
      wsFrom = pos
      wsEnd = p
      wsEndCol = c
    }
    return wsEndCol - col
  }
  /** Consumes up to `max` columns of whitespace, splitting a tab if needed. */
  const skip = (max: number): number => {
    const start = col
    while (pos < lineEnd && col - start < max) {
      const ch = md.charCodeAt(pos)
      if (ch === 32) {
        pos++
        col++
      } else if (ch === 9) {
        const width = 4 - (col % 4)
        if (col - start + width > max) {
          col = start + max
          break
        }
        pos++
        col += width
      } else break
    }
    return col - start
  }
  const restore = (p: number, c: number) => {
    pos = p
    col = c
  }

  const thematicBreak = (): boolean => {
    const marker = md.charCodeAt(pos)
    if (marker === breakChar && pos < breakStop) return false
    let count = 0
    let p = pos
    for (; p < lineEnd; p++) {
      const ch = md.charCodeAt(p)
      if (ch === marker) count++
      else if (!isSpace(ch)) break
    }
    if (p === lineEnd) return count >= 3
    breakChar = marker
    breakStop = p
    return false
  }
  const atxHeading = (): boolean => {
    let p = pos
    while (p < lineEnd && md.charCodeAt(p) === 35) p++
    return p - pos <= 6 && (p === lineEnd || isSpace(md.charCodeAt(p)))
  }
  const setextUnderline = (): boolean => {
    const marker = md.charCodeAt(pos)
    let p = pos
    while (p < lineEnd && md.charCodeAt(p) === marker) p++
    while (p < lineEnd && isSpace(md.charCodeAt(p))) p++
    return p === lineEnd
  }
  /** An opening code fence: returns its length, or 0. */
  const fence = (): number => {
    const marker = md.charCodeAt(pos)
    let p = pos
    while (p < lineEnd && md.charCodeAt(p) === marker) p++
    const size = p - pos
    if (size < 3) return 0
    if (marker === 96) for (; p < lineEnd; p++) if (md.charCodeAt(p) === 96) return 0
    return size
  }
  const closingFence = (): boolean => {
    skip(3)
    let p = pos
    while (p < lineEnd && md.charCodeAt(p) === fenceChar) p++
    if (p - pos < fenceSize) return false
    while (p < lineEnd && isSpace(md.charCodeAt(p))) p++
    return p === lineEnd
  }

  /** A complete open or closing tag alone on its line (HTML block kind 7). */
  const completeTag = (p: number, closing: boolean): boolean => {
    const at = (i: number) => (i < lineEnd ? md.charCodeAt(i) : -1)
    if (closing) while (isSpace(at(p))) p++
    else
      for (let named = false; ; ) {
        while (isSpace(at(p))) p++
        let c = at(p)
        if (named && c === 61) {
          p++
          while (isSpace(at(p))) p++
          c = at(p)
          if (c === -1 || c === 60 || c === 61 || c === 62 || c === 96) return false
          if (c === 34 || c === 39) {
            const close = find(c === 34 ? '"' : "'", p + 1)
            if (close === -1 || close >= lineEnd) return false
            p = close + 1
            c = at(p)
            if (c !== 47 && c !== 62 && !isSpace(c)) return false
            named = false
          } else {
            for (; ; p++) {
              c = at(p)
              if (c === -1 || c === 34 || c === 39 || c === 47 || c === 60) break
              if (c === 61 || c === 62 || c === 96 || isSpace(c)) break
            }
          }
          continue
        }
        if (c === 58 || c === 95 || isAlpha(c)) {
          while (isAttrChar(at(++p)));
          named = true
          continue
        }
        if (c === 47) p++
        break
      }
    if (at(p) !== 62) return false
    p++
    while (isSpace(at(p))) p++
    return p === lineEnd
  }
  /** The kind (1–7) of an HTML block starting at `pos`, or 0. Sets where its end is searched. */
  const htmlOpening = (interrupt: boolean, lazy: boolean): number => {
    const at = (i: number) => (i < lineEnd ? md.charCodeAt(i) : -1)
    let c = at(pos + 1)
    if (c === 33) {
      c = at(pos + 2)
      htmlFrom = pos + 2
      if (c === 45) return at(pos + 3) === 45 ? 2 : 0
      if (c === 91 && md.startsWith('CDATA[', pos + 3) && pos + 9 <= lineEnd) {
        htmlFrom = pos + 9
        return 5
      }
      return isAlpha(c) ? 4 : 0
    }
    if (c === 63) {
      htmlFrom = pos + 1
      return 3
    }
    const closing = c === 47
    const start = closing ? pos + 2 : pos + 1
    if (!isAlpha(at(start))) return 0
    let p = start
    while (isTagChar(at(p))) p++
    c = at(p)
    if (c !== -1 && c !== 47 && c !== 62 && !isSpace(c)) return 0
    const name = md.slice(start, p).toLowerCase()
    htmlFrom = p
    if (c !== 47 && !closing && RAW_TAGS.has(name)) return 1
    if (BLOCK_TAGS.has(name)) return c !== 47 || at(p + 1) === 62 ? 6 : 0
    if (interrupt && !lazy) return 0
    return completeTag(p, closing) ? 7 : 0
  }
  /** Whether the current line holds the end of the HTML block (kinds 1–5). */
  const htmlEnds = (from: number): boolean => {
    const at = find(htmlKind === 1 ? RAW_END : (BLOCK_END[htmlKind] as string), from)
    return at !== -1 && at < lineEnd
  }

  /** A list item at `pos`, after `prefix` columns of indentation. Continues `list` if given. */
  const listItem = (
    prefix: number,
    list: Container | undefined,
    interrupt: boolean,
  ): Container | undefined => {
    const c = char()
    let p = pos + 1
    if (c === 42 || c === 43 || c === 45) {
      if (list && (list.ordered || list.marker !== c)) return undefined
      if (c !== 43 && thematicBreak()) return undefined
    } else if (isDigit(c)) {
      if (list && !list.ordered) return undefined
      if (interrupt && c !== 49) return undefined
      while (p < lineEnd && p - pos < 9 && isDigit(md.charCodeAt(p))) p++
      if (interrupt && p - pos > 1) return undefined
      const m = p < lineEnd ? md.charCodeAt(p) : -1
      if (list ? m !== list.marker : m !== 46 && m !== 41) return undefined
      p++
    } else return undefined
    const marker = md.charCodeAt(p - 1)
    const width = p - pos
    pos = p
    col += width
    let size = prefix + width + 1
    const startsBlank = blank()
    if (startsBlank) {
      if (interrupt) return undefined
    } else {
      const ws = skip(4)
      if (ws && !isSpace(char())) size = prefix + width + ws
      else {
        restore(p, col - ws)
        if (!isSpace(char())) return undefined
        skip(1)
      }
    }
    const item = list ?? container(false, isDigit(c), marker)
    item.size = size
    item.blankStart = startsBlank
    item.furtherBlank = false
    return item
  }
  /** `>` after up to 3 columns of indentation, and one column of space after it. */
  const quoteMarker = (): boolean => {
    const p = pos
    const c = col
    skip(3)
    if (char() !== 62) {
      restore(p, c)
      return false
    }
    pos++
    col++
    if (isSpace(char())) skip(1)
    return true
  }
  /** Opens a block quote or a list at `pos`. */
  const openContainer = (interrupt: boolean): Container | undefined => {
    if (quoteMarker()) return container(true)
    const p = pos
    const c = col
    const item = listItem(skip(3), undefined, interrupt)
    if (!item) restore(p, c)
    return item
  }
  const push = (open: Container) => {
    open.index = stack.length
    stack.push(open)
    if (open.quote) quotes.push(open.index)
    if (open.blankStart) blankItem = open
  }
  const truncate = (size: number) => {
    stack.length = size
    while ((quotes[quotes.length - 1] ?? -1) >= size) quotes.pop()
    if (blankItem && blankItem.index >= size) blankItem = undefined
  }

  /** Records inline HTML of a paragraph or heading; returns whether it has text besides definitions. */
  const inline = (segments: number[], definitions: boolean): boolean => {
    let text = ''
    for (let k = 0; k < segments.length; k += 2)
      text += (k ? '\n' : '') + md.slice(segments[k], segments[k + 1])
    const { html, body } = inlineHtml(text, definitions)
    // Map offsets in `text` back to `md`: segment k starts at `base` in `text`.
    let k = 0
    let base = 0
    const offset = (t: number): number => {
      for (;;) {
        const length = (segments[k + 1] as number) - (segments[k] as number)
        if (k + 2 >= segments.length || t <= base + length) break
        base += length + 1
        k += 2
      }
      return (segments[k] as number) + t - base
    }
    for (let r = 0; r < html.length; r += 2)
      ranges.push(offset(html[r] as number), offset((html[r + 1] as number) - 1) + 1)
    return body < text.length
  }
  /** Ends the open leaf block. An HTML block of kinds 1–5 ended by a new container runs to `to`. */
  const closeLeaf = (to?: number): boolean => {
    let text = false
    if (leaf === PARAGRAPH) text = inline(paragraph, true)
    else if (leaf === HTML) ranges.push(htmlStart, to !== undefined && htmlKind < 6 ? to : htmlEnd)
    leaf = NONE
    return text
  }

  /**
   * Whether a paragraph line is interrupted: 1 by a block, 2 by a setext underline, 3 by a lone
   * tag (only on lazy lines), else 0.
   */
  const interruption = (lazy: boolean): number => {
    const p = pos
    const c0 = col
    skip(3)
    const c = char()
    let kind = 0
    if (c === 35) kind = atxHeading() ? 1 : 0
    else if ((c === 61 || c === 45) && !lazy && setextUnderline()) kind = 2
    else if (c === 42 || c === 45 || c === 95) kind = thematicBreak() ? 1 : 0
    else if (c === 60) {
      const html = htmlOpening(true, lazy)
      kind = html === 7 ? 3 : html ? 1 : 0
    } else if (c === 96 || c === 126) kind = fence() ? 1 : 0
    restore(p, c0)
    return kind
  }

  /** The rest of the line after its containers. */
  const flow = (lazy: boolean, continued: number) => {
    let outside = lazy
    if (leaf === FENCED) {
      if (!lazy) {
        if (closingFence()) leaf = NONE
        return
      }
      leaf = NONE
    } else if (leaf === HTML) {
      if (!lazy && !(htmlKind > 5 && blank())) {
        htmlEnd = lineEnd
        if (htmlKind < 6 && htmlEnds(pos)) closeLeaf()
        return
      }
      closeLeaf()
    } else if (leaf === INDENTED) {
      if (!lazy && (blank() || indent() >= 4)) return
      leaf = NONE
    } else if (leaf === PARAGRAPH) {
      if (blank()) closeLeaf()
      else {
        const kind = indent() >= 4 ? 0 : interruption(lazy)
        if (!kind) {
          paragraph.push(pos, lineEnd)
          return
        }
        // A setext underline after nothing but definitions is a line of its own.
        if (closeLeaf() && kind === 2) return
        // micromark only settles a lone tag on the next line, so until then the tag stays in
        // the containers and the paragraph counts as open.
        if (kind === 3) {
          outside = false
          pending = true
        }
      }
    }
    // Lazy lines that do not continue a paragraph are outside the containers they skipped.
    if (outside) truncate(continued)
    if (blank()) return
    if (indent() >= 4) {
      leaf = INDENTED
      return
    }
    skip(3)
    const c = char()
    if (c === 35 && atxHeading()) {
      inline([pos, lineEnd], false)
      return
    }
    if ((c === 42 || c === 45 || c === 95) && thematicBreak()) return
    const kind = c === 60 ? htmlOpening(false, lazy) : 0
    if (kind) {
      leaf = HTML
      htmlKind = kind
      htmlStart = pos
      htmlEnd = lineEnd
      if (kind < 6 && htmlEnds(htmlFrom)) closeLeaf()
      return
    }
    const size = c === 96 || c === 126 ? fence() : 0
    if (size) {
      leaf = FENCED
      fenceChar = c
      fenceSize = size
      return
    }
    leaf = PARAGRAPH
    paragraph = [pos, lineEnd]
  }

  const line = () => {
    pos = lineStart
    col = 0
    wsFrom = -1
    breakStop = -1
    lastText = lineEnd - 1
    while (lastText >= lineStart && isSpace(md.charCodeAt(lastText))) lastText--

    // Continue the open containers. Lists continue on blank lines and block quotes do not, so a
    // blank line jumps straight to the next block quote.
    let continued = 0
    for (let quote = 0; continued < stack.length; ) {
      const open = stack[continued] as Container
      if (open.quote) {
        if (!quoteMarker()) break
        continued++
        quote++
        continue
      }
      if (blank()) {
        const next = quotes[quote] ?? stack.length
        if (blankItem && blankItem.index < next) blankItem.furtherBlank = true
        continued = next
        break
      }
      const further = open.furtherBlank
      if (open === blankItem) blankItem = undefined
      open.blankStart = open.furtherBlank = false
      if (!further && isSpace(char()) && indent() >= open.size) {
        skip(open.size)
        continued++
        continue
      }
      // A new item of the same list ends the current item.
      const p = pos
      const c = col
      const item = listItem(skip(3), open, false)
      if (!item) {
        restore(p, c)
        break
      }
      continued++
      closeLeaf(lineStart)
      truncate(continued)
      if (item.blankStart) blankItem = item
      break
    }

    // Open new containers, unless the line belongs to an open code fence or HTML block.
    const all = continued === stack.length
    const open = pending || leaf === PARAGRAPH || leaf === INDENTED
    pending = false
    let lazy = false
    if (!all || open || (leaf !== FENCED && leaf !== HTML)) {
      const interrupt = all && open
      let next = openContainer(interrupt)
      if (next) {
        closeLeaf(lineStart)
        truncate(continued)
        for (; next; next = openContainer(interrupt)) push(next)
      } else lazy = !all
    }
    flow(lazy, continued)
  }

  const lineBreak = /\r\n?|\n/g
  for (;;) {
    const match = lineBreak.exec(md)
    lineEnd = match ? match.index : md.length
    line()
    if (!match) break
    lineStart = lineBreak.lastIndex
  }
  closeLeaf()
  return ranges
}
