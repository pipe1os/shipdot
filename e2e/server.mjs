// Minimal static server for the e2e fixtures and the built widget.
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const roots = { '/dist/': join(here, '../packages/shipdot/dist'), '/': join(here, 'fixtures') }
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
}
const port = Number(process.env.PORT ?? 4173)

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  const [prefix, root] = Object.entries(roots).find(([p]) => path.startsWith(p))
  const file = normalize(join(root, path.slice(prefix.length) || 'index.html'))
  if (!file.startsWith(root)) return res.writeHead(403).end()
  try {
    const body = await readFile(file)
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(port, () => console.log(`e2e server on http://localhost:${port}`))
