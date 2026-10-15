// Serves every Markdown docs page as plain Markdown at `<page>.md` (e.g. /shipdot/guides/i18n.md),
// for the "Copy page" button and for people who paste the docs into an AI assistant.
// MDX pages (home, playground) are interactive and are left out.

import { type CollectionEntry, getCollection } from 'astro:content'
import type { APIRoute, GetStaticPaths } from 'astro'

export const getStaticPaths = (async () => {
  const pages = await getCollection('docs', (entry) => entry.filePath?.endsWith('.md'))
  return pages.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))
}) satisfies GetStaticPaths

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props, site }) => {
  const { title, description } = props.entry.data
  const origin = new URL('/', site).href
  // Root-relative links (`/shipdot/guides/…`) become absolute so they still work outside the site.
  const body = (props.entry.body ?? '').trim().replaceAll('](/', `](${origin}`)
  const markdown = [`# ${title}`, description && `> ${description}`, body]
    .filter(Boolean)
    .join('\n\n')
  return new Response(`${markdown}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
