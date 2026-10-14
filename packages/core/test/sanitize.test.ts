import { renderMarkdown } from '@shipdot/core/compile'
import { describe, expect, it } from 'vitest'

describe('renderMarkdown sanitization', () => {
  it('keeps the allowlisted formatting', () => {
    expect(
      renderMarkdown(
        '**bold** *em* `code`\n\n- a\n- b\n\n3. three\n\n```js\nlet x\n```\n\nline  \nbreak',
      ),
    ).toBe(
      '<p><strong>bold</strong> <em>em</em> <code>code</code></p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n<ol start="3">\n<li>three</li>\n</ol>\n<pre><code>let x\n</code></pre>\n<p>line<br>\nbreak</p>',
    )
  })

  it('demotes headings to h3/h4', () => {
    expect(renderMarkdown('# One\n## Two\n### Three\n#### Four\n##### Five')).toBe(
      '<h3>One</h3>\n<h3>Two</h3>\n<h3>Three</h3>\n<h4>Four</h4>\n<h4>Five</h4>',
    )
  })

  it('opens http(s) links in a new tab safely and keeps mailto', () => {
    expect(renderMarkdown('[docs](https://example.com) [mail](mailto:a@b.co)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a> <a href="mailto:a@b.co">mail</a></p>',
    )
  })

  const vectors: [string, string][] = [
    ['<script>alert(1)</script>', ''],
    ['<img src=x onerror=alert(1)>', ''],
    ['<iframe src="https://evil.example"></iframe>', ''],
    ['[x](javascript:alert(1))', '<p><a>x</a></p>'],
    ['[x](JaVaScRiPt:alert(1))', '<p><a>x</a></p>'],
    ['[x](vbscript:msgbox(1))', '<p><a>x</a></p>'],
    ['[x](data:text/html;base64,PHNjcmlwdD4=)', '<p><a>x</a></p>'],
    ['![x](data:image/png;base64,AAAA)', '<p><img alt="x" loading="lazy"></p>'],
    ['![x](http://insecure.example/a.png)', '<p><img alt="x" loading="lazy"></p>'],
    ['![x](javascript:alert(1))', '<p><img alt="x" loading="lazy"></p>'],
    ['<a href="https://ok.example" onclick="alert(1)">a</a>', '<p>a</p>'],
    ['<div style="position:fixed">x</div>', ''],
    ['<svg><script>alert(1)</script></svg>', '<p>alert(1)</p>'],
    ['<!-- comment --> text', ''],
  ]

  it.each(vectors)('neutralizes %s', (markdown, html) => {
    expect(renderMarkdown(markdown)).toBe(html)
  })

  it('upgrades protocol-relative URLs to https', () => {
    expect(renderMarkdown('![x](//cdn.example/a.png)')).toBe(
      '<p><img src="https://cdn.example/a.png" alt="x" loading="lazy"></p>',
    )
  })

  it('never outputs event handlers or javascript: URLs for any vector', () => {
    const html = vectors.map(([md]) => renderMarkdown(md)).join('')
    expect(html).not.toMatch(/\son\w+=/i)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<(script|iframe|svg|style|div)/i)
  })
})
