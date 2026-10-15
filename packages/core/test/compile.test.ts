import { validateFeed } from '@shipdot/core'
import {
  compile,
  parseEntryFile,
  type SourceFile,
  serializeEntry,
  stripHtmlComments,
} from '@shipdot/core/compile'
import { describe, expect, it } from 'vitest'

const options = { defaultLocale: 'en', locales: ['en', 'es'], generatedAt: '2026-10-14T21:00:00Z' }

const file = (path: string, content: string): SourceFile => ({ path, content })

const exportExcel = file(
  '2026-10-14-export-excel.md',
  `---
date: 2026-10-14
type: new
title: Export to Excel
target: "#btn-export"
link: https://example.com/docs/export
pr: 42
---
You can now export any report to **Excel** with one click.
`,
)

const exportExcelEs = file(
  '2026-10-14-export-excel.es.md',
  `---
title: Exportar a Excel
---
Ahora puedes exportar cualquier reporte a Excel.
`,
)

const errors = (files: SourceFile[], opts = options) =>
  compile(files, opts)
    .diagnostics.filter((d) => d.severity === 'error')
    .map((d) => `${d.file}:${d.line} ${d.message}`)

describe('compile', () => {
  it('compiles entries into a valid v1 feed', () => {
    const result = compile([exportExcel, exportExcelEs], options)
    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(validateFeed(result.feed)).toEqual([])
    expect(result.feed).toEqual({
      $schema: 'https://unpkg.com/@shipdot/core/schema/v1.json',
      version: 1,
      generatedAt: '2026-10-14T21:00:00Z',
      defaultLocale: 'en',
      entries: [
        {
          id: '2026-10-14-export-excel',
          date: '2026-10-14',
          type: 'new',
          title: 'Export to Excel',
          html: '<p>You can now export any report to <strong>Excel</strong> with one click.</p>',
          target: '#btn-export',
          link: 'https://example.com/docs/export',
          i18n: {
            es: {
              title: 'Exportar a Excel',
              html: '<p>Ahora puedes exportar cualquier reporte a Excel.</p>',
            },
          },
        },
      ],
    })
  })

  it('sorts entries newest first, then by id', () => {
    const entry = (name: string, date: string) =>
      file(`${name}.md`, `---\ndate: ${date}\ntype: fixed\ntitle: ${name}\n---\n`)
    const { feed } = compile(
      [entry('a', '2026-01-01'), entry('c', '2026-03-01'), entry('b', '2026-03-01')],
      options,
    )
    expect(feed.entries.map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('uses the frontmatter id over the file name', () => {
    const { feed } = compile(
      [file('x.md', '---\nid: custom-id\ndate: 2026-10-14\ntype: improved\ntitle: X\n---\nBody')],
      options,
    )
    expect(feed.entries[0]?.id).toBe('custom-id')
  })

  it('reports missing frontmatter and invalid YAML with line numbers', () => {
    expect(errors([file('a.md', 'just text')])).toEqual([
      'a.md:1 missing frontmatter: the file must start with a "---" block',
    ])
    const [message] = errors([file('b.md', '---\ndate: 2026-10-14\ntitle: [oops\n---\n')])
    expect(message).toMatch(/^b\.md:\d+ invalid YAML/)
    expect(errors([file('c.md', '---\n- a\n- b\n---\n')])).toEqual([
      'c.md:2 frontmatter must be a mapping of keys to values',
    ])
  })

  it('reports invalid fields at the line of the key', () => {
    const bad = file(
      'bad.md',
      `---
date: 2026-02-30
type: feature
title: ""
link: javascript:alert(1)
image: http://example.com/a.png
target: ""
pr: -1
---
`,
    )
    expect(errors([bad])).toEqual([
      'bad.md:2 invalid date "2026-02-30": use a real date as YYYY-MM-DD',
      'bad.md:3 unknown type "feature": use new | improved | fixed',
      'bad.md:4 "title" must be a non-empty string',
      'bad.md:7 "target" must be a CSS selector string, like "#btn-export"',
      'bad.md:5 "link" must be an http(s) URL',
      'bad.md:6 "image" must be an https URL or a relative path',
      'bad.md:8 "pr" must be a pull request number',
    ])
  })

  it('reports missing required keys', () => {
    expect(errors([file('empty.md', '---\n---\n')])).toEqual([
      'empty.md:1 missing required key "date" (YYYY-MM-DD)',
      'empty.md:1 missing required key "type" (new | improved | fixed)',
      'empty.md:1 missing required key "title"',
    ])
  })

  it('reports duplicate ids', () => {
    const a = file('a.md', '---\nid: same\ndate: 2026-10-14\ntype: new\ntitle: A\n---\n')
    const b = file('b.md', '---\nid: same\ndate: 2026-10-14\ntype: new\ntitle: B\n---\n')
    expect(errors([a, b])).toEqual(['b.md:2 duplicate id "same" (already used by a.md)'])
  })

  it('warns about unknown keys without failing', () => {
    const result = compile(
      [file('a.md', '---\ndate: 2026-10-14\ntype: new\ntitle: A\ntittle: typo\n---\n')],
      options,
    )
    expect(result.ok).toBe(true)
    expect(result.diagnostics).toMatchObject([
      { severity: 'warning', line: 5, message: expect.stringContaining('unknown key "tittle"') },
    ])
  })

  describe('translations', () => {
    it('reports orphan translations', () => {
      expect(errors([file('ghost.es.md', '---\ntitle: Fantasma\n---\n')])).toEqual([
        'ghost.es.md:1 orphan translation: ghost.md does not exist',
      ])
    })

    it('reports undeclared locales', () => {
      const fr = file('2026-10-14-export-excel.fr.md', '---\ntitle: Exporter\n---\n')
      expect(errors([exportExcel, fr])).toEqual([
        '2026-10-14-export-excel.fr.md:1 locale "fr" is not declared in shipdot.config.json "locales" (en, es)',
      ])
    })

    it('rejects translations of the default locale and of non-translatable keys', () => {
      const en = file('2026-10-14-export-excel.en.md', '---\ntitle: Export\n---\n')
      const es = file(
        '2026-10-14-export-excel.es.md',
        '---\ntitle: Exportar\ntype: fixed\nid: other\n---\n',
      )
      expect(errors([exportExcel, en, es])).toEqual([
        '2026-10-14-export-excel.en.md:1 "en" is the default locale: put this content in 2026-10-14-export-excel.md instead',
        '2026-10-14-export-excel.es.md:3 "type" cannot be translated: only "title" and the body can (set it in 2026-10-14-export-excel.md)',
        '2026-10-14-export-excel.es.md:4 id "other" does not match "2026-10-14-export-excel" in 2026-10-14-export-excel.md',
      ])
    })

    it('does not mistake dotted ids for translations', () => {
      const { feed, ok } = compile(
        [file('release-v1.2.md', '---\ndate: 2026-10-14\ntype: new\ntitle: v1.2\n---\n')],
        options,
      )
      expect(ok).toBe(true)
      expect(feed.entries[0]?.id).toBe('release-v1.2')
    })
  })

  describe('assets', () => {
    it('collects relative images and rewrites them under shipdot-assets/', () => {
      const result = compile(
        [
          file(
            '2026/launch.md',
            '---\ndate: 2026-10-14\ntype: new\ntitle: Launch\nimage: ./hero.png\n---\n![Chart](../img/chart.png)\n![Remote](https://cdn.example.com/x.png)',
          ),
        ],
        options,
      )
      expect(result.ok).toBe(true)
      const [entry] = result.feed.entries
      expect(entry?.image).toBe('shipdot-assets/2026/hero.png')
      expect(entry?.html).toBe(
        '<p><img src="shipdot-assets/img/chart.png" alt="Chart" loading="lazy">\n<img src="https://cdn.example.com/x.png" alt="Remote" loading="lazy"></p>',
      )
      expect(result.assets).toEqual([
        { from: 'img/chart.png', to: 'shipdot-assets/img/chart.png' },
        { from: '2026/hero.png', to: 'shipdot-assets/2026/hero.png' },
      ])
    })

    it('rejects images outside the entries directory', () => {
      expect(
        errors([
          file(
            'a.md',
            '---\ndate: 2026-10-14\ntype: new\ntitle: A\nimage: ../../secret.png\n---\n',
          ),
        ]),
      ).toEqual(['a.md:5 image "../../secret.png" points outside the entries directory'])
    })
  })

  describe('llms.txt', () => {
    it('lists updates with one-line summaries', () => {
      const { llms, llmsFull } = compile([exportExcel, exportExcelEs], {
        ...options,
        name: 'Acme',
        url: 'https://acme.example',
      })
      expect(llms).toBe(`# Acme: what's new

> Product updates for Acme, newest first.

## Updates

- [Export to Excel](https://example.com/docs/export): New on 2026-10-14. You can now export any report to Excel with one click.

## Optional

- [Full update notes](https://acme.example/llms-full.txt): every update with its complete text.
`)
      expect(llmsFull).toBe(`# Acme: what's new

> Product updates for Acme, newest first.

## Export to Excel

Date: 2026-10-14 · Type: New · Link: https://example.com/docs/export

You can now export any report to **Excel** with one click.
`)
    })

    it('handles an empty feed', () => {
      expect(compile([], options).llms).toContain('- No updates yet.')
    })
  })
})

describe('parseEntryFile', () => {
  it('handles CRLF line endings and a BOM', () => {
    const parsed = parseEntryFile(
      file('a.md', '﻿---\r\ndate: 2026-10-14\r\ntitle: A\r\n---\r\nBody\r\n'),
    )
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.data).toEqual({ date: '2026-10-14', title: 'A' })
    expect(parsed.positions.title).toEqual({ line: 3, column: 1 })
    expect(parsed.body).toBe('Body\r\n')
  })
})

describe('serializeEntry', () => {
  it('round-trips through parseEntryFile', () => {
    const data = {
      date: '2026-10-14',
      type: 'new',
      title: 'Export: "Excel"',
      target: '#btn',
      link: undefined,
    }
    const text = serializeEntry(data, '\nHello **world**\n\n')
    expect(text).toBe(
      '---\ndate: 2026-10-14\ntype: new\ntitle: \'Export: "Excel"\'\ntarget: "#btn"\n---\nHello **world**\n',
    )
    const parsed = parseEntryFile(file('a.md', text))
    expect(parsed.data).toEqual({
      date: '2026-10-14',
      type: 'new',
      title: 'Export: "Excel"',
      target: '#btn',
    })
  })
})

describe('stripHtmlComments', () => {
  it('removes comments, including unterminated ones', () => {
    expect(stripHtmlComments('a<!-- x -->b<!-- y -->c')).toBe('abc')
    expect(stripHtmlComments('a\n<!--\nmulti\nline\n-->\nb')).toBe('a\n\nb')
    expect(stripHtmlComments('a <!-- never closed')).toBe('a ')
    expect(stripHtmlComments('no comments, a < b -> c')).toBe('no comments, a < b -> c')
  })

  it('never leaves a comment opener formed by removing another comment', () => {
    expect(stripHtmlComments('a<!<!-- x -->-- y -->b')).toBe('ab')
    expect(stripHtmlComments('<<!-- -->!<!-- -->-<!-- -->-<script>')).toBe('')
    const nested = `${'<!'.repeat(5000)}${'<!-- -->--'.repeat(5000)}`
    expect(stripHtmlComments(nested)).not.toContain('<!--')
  })
})
