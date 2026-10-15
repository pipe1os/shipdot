import { stripHtmlComments } from '@shipdot/core/compile'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

describe('stripHtmlComments', () => {
  it('removes inline and block comments', () => {
    expect(stripHtmlComments('a<!-- x -->b<!-- y -->c')).toBe('abc')
    expect(stripHtmlComments('a\n<!--\nmulti\nline\n-->\nb')).toBe('a\n\nb')
    expect(stripHtmlComments('<!-- note --> kept\n\nPara')).toBe(' kept\n\nPara')
    expect(stripHtmlComments('> <!--\n> quoted\n> -->\n> after')).toBe('> \n> after')
    expect(stripHtmlComments('no comments, a < b -> c')).toBe('no comments, a < b -> c')
  })

  it('treats <!--> and <!---> as empty comments', () => {
    expect(stripHtmlComments('a <!--> b')).toBe('a  b')
    expect(stripHtmlComments('a <!---> b')).toBe('a  b')
    expect(stripHtmlComments('<!--> b\n\nc')).toBe(' b\n\nc')
  })

  it('hides the rest of the document after an unclosed comment block', () => {
    expect(stripHtmlComments('Text\n<!-- never closed\n\nMore')).toBe('Text\n')
  })

  it('keeps <!-- that Markdown shows as text', () => {
    const code = 'Type `<!--` to start.\n\n```html\n<!-- example -->\n```\n\nMore'
    expect(stripHtmlComments(code)).toBe(code)
    expect(stripHtmlComments('a <!-- never closed')).toBe('a <!-- never closed')
  })

  it('follows block quotes, list items and lazy lines', () => {
    const code = '> ```\n> <!-- kept -->\n> ```\n\n- item\n\n      <!-- kept -->\n'
    expect(stripHtmlComments(code)).toBe(code)
    expect(stripHtmlComments('- a\n  <!-- x -->\n- b')).toBe('- a\n  \n- b')
    expect(stripHtmlComments('- a\n\n  <!-- x\n\n  -->\n- b')).toBe('- a\n\n  \n- b')
    expect(stripHtmlComments('1. a\n   `<!--` <!-- x --> `-->`')).toBe('1. a\n   `<!--`  `-->`')
    expect(stripHtmlComments('> a\nb <!-- x -->')).toBe('> a\nb ')
  })

  it('treats link destinations, titles, definitions and image labels as text', () => {
    const links = '[a](<!--x-->) [b](u "<!--x-->") ![<!--x-->](u)\n\n[c]: /u "<!--x-->"'
    expect(stripHtmlComments(links)).toBe(links)
    expect(stripHtmlComments('[a <!--x--> b](u)')).toBe('[a  b](u)')
  })

  it('runs in linear time on deeply nested lists and block quotes', () => {
    const started = performance.now()
    expect(stripHtmlComments(`${'- '.repeat(30_000)}<!-- x -->`)).toBe('- '.repeat(30_000))
    expect(stripHtmlComments(`${'> '.repeat(30_000)}<!-- x -->`)).toBe('> '.repeat(30_000))
    expect(stripHtmlComments(`${'1. '.repeat(20_000)}<!-- x -->`)).toBe('1. '.repeat(20_000))
    const lazy = `${'> '.repeat(15_000)}a\n${'b\n'.repeat(15_000)}`
    expect(stripHtmlComments(`${lazy}<!-- x -->`)).toBe(lazy)
    const blank = `${'- '.repeat(15_000)}a${'\n'.repeat(15_000)}`
    expect(stripHtmlComments(`${blank}<!-- x -->`)).toBe(blank)
    // Each takes seconds to minutes with a Markdown parser; the bound is loose so slow runners
    // do not flake.
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('matches remark on random Markdown', () => {
    // Pieces that change how `<!--` is read: containers, indentation, code, HTML and links.
    // biome-ignore format: one piece per entry would take 50 lines
    const pieces = ['> ', '- ', '1. ', '2) ', '  ', '    ', '\t', '\n', '\n', '\n\n', '\r\n', '`', '``', '```', '~~~', '\\', '<!--', '<!--', '-->', '-->', '<!-->', '<div>', '</div>', '<pre>', '</pre>', '<a b="x">', '<a', '"', '>', '<', '<?', '?>', '<!X', '<![CDATA[', ']]>', '<x>', '<http://a>', '<a@b.c>', '[', ']', '(', ')', '![', '](', ']: ', '#', '# ', '===', '---', '***', 'a', 'b ']
    let seed = 1
    const random = (size: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return Math.floor((seed / 0x80000000) * size)
    }
    for (let run = 0; run < 3000; run++) {
      const pick = () => pieces[random(pieces.length)]
      const markdown = Array.from({ length: 1 + random(40) }, pick).join('')
      expect(stripHtmlComments(markdown), JSON.stringify(markdown)).toBe(stripWithRemark(markdown))
    }
  })
})

interface MdNode {
  type: string
  children?: MdNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

/** The parser-based implementation the scanner replaced: the same output in quadratic time. */
function stripWithRemark(markdown: string): string {
  const html: [start: number, end: number][] = []
  const stack = [unified().use(remarkParse).parse(markdown) as MdNode]
  for (let node = stack.pop(); node; node = stack.pop()) {
    const { start, end } = node.position ?? {}
    if (node.type === 'html') html.push([start?.offset ?? 0, end?.offset ?? 0])
    stack.push(...(node.children ?? []))
  }
  let out = ''
  let from = 0
  for (const [start, end] of html.sort((a, b) => a[0] - b[0])) {
    const raw = markdown.slice(start, end)
    out += markdown.slice(from, start) + raw.replace(/<!--(?:-?>|[\s\S]*?(?:-->|$))/g, '')
    from = end
  }
  return out + markdown.slice(from)
}
