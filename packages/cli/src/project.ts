import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { CONFIG_FILE, type Diagnostic, resolveConfig, type ShipdotConfig } from '@shipdot/core'
import { ASSETS_DIR, type CompileResult, compile, type SourceFile } from '@shipdot/core/compile'

export interface Project {
  /** Absolute project root (where the config lives). */
  root: string
  config: ShipdotConfig
  /** Absolute path of the config file, or undefined when running on defaults. */
  configPath: string | undefined
  problems: Diagnostic[]
}

const toPosix = (path: string) => path.split(sep).join('/')

/** Loads `shipdot.config.json` (or `configPath`) and resolves defaults. */
export async function loadProject(cwd: string, configPath?: string): Promise<Project> {
  const file = resolve(cwd, configPath ?? CONFIG_FILE)
  let text: string | undefined
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (configPath || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const root = text === undefined ? resolve(cwd) : dirname(file)
  const shown = toPosix(relative(cwd, file)) || CONFIG_FILE
  if (text === undefined) {
    return { root, config: resolveConfig({}).config, configPath: undefined, problems: [] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return {
      root,
      config: resolveConfig({}).config,
      configPath: file,
      problems: [
        { severity: 'error', file: shown, message: `invalid JSON: ${(error as Error).message}` },
      ],
    }
  }
  const { config, problems } = resolveConfig(raw)
  return {
    root,
    config,
    configPath: file,
    problems: problems.map((message) => ({ severity: 'error', file: shown, message })),
  }
}

/** Reads every `.md` file under the entries directory. Paths are POSIX, relative to it. */
export async function readEntries(project: Project): Promise<SourceFile[]> {
  const dir = resolve(project.root, project.config.entriesDir)
  let names: string[]
  try {
    names = await readdir(dir, { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const files = names.filter((name) => name.endsWith('.md')).sort()
  return Promise.all(
    files.map(async (name) => ({
      path: toPosix(name),
      content: await readFile(join(dir, name), 'utf8'),
    })),
  )
}

export interface BuildResult extends CompileResult {
  /** Files written, relative to the project root. */
  written: string[]
}

/** Validates and compiles entries. With `write`, writes outputs and copies assets. */
export async function buildProject(
  project: Project,
  options: { write: boolean; generatedAt?: string },
): Promise<BuildResult> {
  const { config, root } = project
  const files = await readEntries(project)
  const result = compile(files, {
    defaultLocale: config.defaultLocale,
    locales: config.locales,
    ...(options.generatedAt && { generatedAt: options.generatedAt }),
    ...(config.name && { name: config.name }),
    ...(config.description && { description: config.description }),
    ...(config.url && { url: config.url }),
  })
  // Diagnostics point at files relative to the project root, so editors can open them.
  const entriesDir = toPosix(relative(root, resolve(root, config.entriesDir)))
  for (const d of result.diagnostics) if (d.file) d.file = `${entriesDir}/${d.file}`
  result.diagnostics.unshift(...project.problems)

  for (const asset of result.assets) {
    const from = resolve(root, config.entriesDir, asset.from)
    const ok = await stat(from).then(
      (s) => s.isFile(),
      () => false,
    )
    if (!ok)
      result.diagnostics.push({
        severity: 'error',
        file: `${entriesDir}/${asset.from}`,
        message: 'image not found',
      })
  }
  const ok = !result.diagnostics.some((d) => d.severity === 'error')
  const written: string[] = []
  if (options.write && ok) {
    const out = resolve(root, config.outDir)
    await mkdir(out, { recursive: true })
    const outputs: [string, string][] = [
      ['shipdot.json', `${JSON.stringify(result.feed, null, 2)}\n`],
      ['llms.txt', result.llms],
      ['llms-full.txt', result.llmsFull],
    ]
    for (const [name, content] of outputs) {
      await writeFile(join(out, name), content)
      written.push(toPosix(relative(root, join(out, name))))
    }
    await rm(join(out, ASSETS_DIR), { recursive: true, force: true })
    for (const asset of result.assets) {
      const target = join(out, asset.to)
      await mkdir(dirname(target), { recursive: true })
      await cp(resolve(root, config.entriesDir, asset.from), target)
      written.push(toPosix(relative(root, target)))
    }
  }
  return { ...result, ok, written }
}
