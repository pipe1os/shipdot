// Pins every CDN snippet in the docs (`https://unpkg.com/shipdot@0.1`) to the current widget
// release. `pnpm version-packages` runs it right after Changesets bumps the versions.
// Usage: node scripts/sync-cdn-version.ts
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const { version } = JSON.parse(
  await readFile(new URL('packages/shipdot/package.json', root), 'utf8'),
)
// Same rule as `shipdot init`: in 0.x a minor release may break, so pin `major.minor`.
const [major, minor] = version.split('.')
const pinned = `unpkg.com/shipdot@${major === '0' ? `${major}.${minor}` : major}`

const files = execFileSync('git', ['ls-files', '*.md', '*.mdx'], {
  cwd: fileURLToPath(root),
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file && !file.endsWith('CHANGELOG.md'))

for (const file of files) {
  const path = new URL(file, root)
  const text = await readFile(path, 'utf8')
  // Bare or range-pinned URLs only; exact versions with a file path are left alone.
  const next = text.replaceAll(/unpkg\.com\/shipdot(?:@[\d.]+)?(?![\w./@-])/g, pinned)
  if (next !== text) {
    await writeFile(path, next)
    console.log(`${file} → ${pinned}`)
  }
}
