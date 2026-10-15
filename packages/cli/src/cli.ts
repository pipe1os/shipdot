import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs, styleText } from 'node:util'
import { CONFIG_FILE, type Diagnostic, formatDiagnostic, type LlmProvider } from '@shipdot/core'
import pkg from '../package.json' with { type: 'json' }
import { draftEntries } from './draft'
import { GitHub, parseRepo } from './github'
import { initProject, WIDGET_IMPORT_SNIPPET, WIDGET_SNIPPET, WORKFLOW_SNIPPET } from './init'
import type { LlmOptions } from './llm'
import { buildProject, loadProject } from './project'

export interface CliIo {
  cwd: string
  env: Record<string, string | undefined>
  stdout: (text: string) => void
  stderr: (text: string) => void
  fetch?: typeof fetch
}

const HELP: Record<string, string> = {
  main: `shipdot ${pkg.version}: in-app release notes from your pull requests

Usage
  shipdot <command> [options]

Commands
  init       Create ${CONFIG_FILE} and an example entry
  build      Validate entries and write shipdot.json, llms.txt and llms-full.txt
  validate   Check entries without writing anything (exit code 1 on errors)
  draft      Draft entries from pull requests merged since the last release

Global options
  --cwd <dir>        Run as if shipdot was started in <dir>
  --config <file>    Path to the config file (default: ${CONFIG_FILE})
  -h, --help         Show help for a command
  -v, --version      Show the version

Run "shipdot <command> --help" for details.
Docs: https://pipe1os.github.io/shipdot/`,
  init: `Usage
  shipdot init [--out-dir <dir>] [--locales en,es]

Creates ${CONFIG_FILE} and .shipdot/entries/<today>-welcome.md.
Existing files are never overwritten.

Options
  --out-dir <dir>    Folder your site serves as-is (default: public/ or static/ if present)
  --locales <list>   Comma-separated locales, default first (default: en)`,
  build: `Usage
  shipdot build

Validates every entry, renders Markdown to sanitized HTML and writes
<outDir>/shipdot.json, <outDir>/llms.txt and <outDir>/llms-full.txt.
Relative images are copied to <outDir>/shipdot-assets/.
Nothing is written if there are errors.`,
  validate: `Usage
  shipdot validate

Checks every entry and translation and prints errors as file:line:column.
Exits with code 1 if any error is found.`,
  draft: `Usage
  shipdot draft [--repo owner/name] [--base main] [--since 2026-10-01] [--dry-run]

Lists pull requests merged into the base branch since the latest tag (or the
latest entry) and writes one draft entry per user-facing pull request.

Skipped: PRs labeled skip-shipdot, bot authors, non-user conventional types
(chore, ci, test, docs, refactor, ...), PRs that already have an entry, and PRs
whose "### shipdot" section says "skip".

Template mode (default, offline): uses the PR's "### shipdot" section, or the
PR title without its conventional prefix.

LLM mode (optional, bring your own key): set SHIPDOT_LLM_PROVIDER
(anthropic | openai-compatible), SHIPDOT_LLM_API_KEY and optionally
SHIPDOT_LLM_MODEL and SHIPDOT_LLM_BASE_URL. Only the PR title and body are sent.

Options
  --repo <owner/name>  Default: GITHUB_REPOSITORY or the "origin" remote
  --base <branch>      Default: draft.baseBranch or the repository default branch
  --since <date>       Only PRs merged after this date (YYYY-MM-DD or ISO)
  --limit <n>          Maximum number of PRs to look at (default: 50)
  --dry-run            Print the drafts instead of writing them
  --no-llm             Use template mode even if an LLM is configured

Auth: GITHUB_TOKEN or GH_TOKEN, falling back to "gh auth token".`,
}

const OPTIONS = {
  cwd: { type: 'string' },
  config: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  'out-dir': { type: 'string' },
  locales: { type: 'string' },
  repo: { type: 'string' },
  base: { type: 'string' },
  since: { type: 'string' },
  limit: { type: 'string' },
  'dry-run': { type: 'boolean' },
  llm: { type: 'boolean' },
} as const

const COMMAND_OPTIONS: Record<string, string[]> = {
  init: ['out-dir', 'locales'],
  build: [],
  validate: [],
  draft: ['repo', 'base', 'since', 'limit', 'dry-run', 'llm'],
}

/** Runs the CLI and returns the exit code. */
export async function run(argv: string[], io: CliIo): Promise<number> {
  const color = (format: Parameters<typeof styleText>[0], text: string) =>
    styleText(format, text, { stream: process.stdout })
  const out = (text = '') => io.stdout(`${text}\n`)
  const err = (text: string) => io.stderr(`${text}\n`)

  let parsed: ReturnType<
    typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true; allowNegative: true }>
  >
  try {
    parsed = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: true,
      allowNegative: true,
    })
  } catch (error) {
    err(`${color('red', 'error')} ${(error as Error).message}\n\n${HELP.main}`)
    return 1
  }
  const { values, positionals } = parsed
  const command = positionals[0]
  if (values.version) {
    out(pkg.version)
    return 0
  }
  if (!command || values.help) {
    out(HELP[command ?? 'main'] ?? HELP.main)
    return command && !HELP[command] ? 1 : 0
  }
  const allowed = COMMAND_OPTIONS[command]
  if (!allowed) {
    err(`${color('red', 'error')} unknown command "${command}"\n\n${HELP.main}`)
    return 1
  }
  const global = ['cwd', 'config', 'help', 'version']
  const extra = Object.keys(values).find((key) => !global.includes(key) && !allowed.includes(key))
  if (extra) {
    err(
      `${color('red', 'error')} "--${extra}" is not an option of "shipdot ${command}"\n\n${HELP[command]}`,
    )
    return 1
  }
  const cwd = resolve(io.cwd, values.cwd ?? '.')

  const report = (diagnostics: Diagnostic[]) => {
    for (const d of diagnostics) {
      const text = formatDiagnostic(d)
      if (d.severity === 'error') err(text.replace(' - error:', ` - ${color('red', 'error')}:`))
      else err(text.replace(' - warning:', ` - ${color('yellow', 'warning')}:`))
    }
    const errors = diagnostics.filter((d) => d.severity === 'error').length
    if (errors) err(color('red', `✖ Found ${errors} error${errors === 1 ? '' : 's'}.`))
    return errors
  }

  try {
    if (command === 'init') {
      const result = await initProject({
        cwd,
        ...(values['out-dir'] && { outDir: values['out-dir'] }),
        ...(values.locales && { locales: values.locales.split(',').map((l) => l.trim()) }),
      })
      for (const file of result.created) out(`${color('green', '+')} ${file}`)
      for (const file of result.skipped)
        out(`${color('dim', '=')} ${file} (exists, left untouched)`)
      out(`
${color('bold', 'Next steps')}
  1. Edit or add entries in .shipdot/entries/
  2. Run ${color('cyan', 'shipdot build')} to write ${result.outDir}/shipdot.json
  3. Add the widget to your app:

${
  result.widgetInstalled
    ? WIDGET_IMPORT_SNIPPET
    : `${WIDGET_SNIPPET}

  Or ${color('cyan', 'npm install shipdot')} and ${color('cyan', "import 'shipdot'")} once on the client.`
}

  Optional: draft entries from merged pull requests every week:

${WORKFLOW_SNIPPET}`)
      return 0
    }

    const project = await loadProject(cwd, values.config)

    if (command === 'build' || command === 'validate') {
      const write = command === 'build'
      const result = await buildProject(project, { write })
      if (report(result.diagnostics)) return 1
      const n = result.feed.entries.length
      const entries = `${n} entr${n === 1 ? 'y' : 'ies'}`
      if (write)
        out(
          `${color('green', '✔')} Built ${entries} → ${result.written.filter((f) => !f.includes('/shipdot-assets/')).join(', ')}`,
        )
      else out(`${color('green', '✔')} ${entries} valid (${project.config.locales.join(', ')})`)
      return 0
    }

    // draft
    if (report(project.problems)) return 1
    const env = io.env
    const repo = values.repo ?? env.GITHUB_REPOSITORY ?? detectRepo(cwd)
    if (!repo) {
      err(`${color('red', 'error')} could not detect the GitHub repository: pass --repo owner/name`)
      return 1
    }
    const limit = values.limit ? Number.parseInt(values.limit, 10) : undefined
    if (limit !== undefined && !(limit > 0)) {
      err(`${color('red', 'error')} --limit must be a positive number`)
      return 1
    }
    const github = new GitHub({
      repo,
      token: env.GITHUB_TOKEN || env.GH_TOKEN || ghToken(),
      apiUrl: env.GITHUB_API_URL,
      ...(io.fetch && { fetch: io.fetch }),
    })
    const llm =
      values.llm === false ? undefined : llmFromEnv(env, project.config.llm, err, io.fetch)
    const result = await draftEntries({
      project,
      github,
      base: values.base,
      since: values.since,
      limit,
      llm,
      log: (message) => err(`${color('yellow', 'warning')} ${message}`),
    })
    const since = result.since
      ? ` since ${result.since.source === 'tag' ? `tag ${result.since.ref} (${result.since.date})` : result.since.date}`
      : ''
    out(
      `Drafting from ${result.repo} (base: ${result.base}${since}${llm ? `, LLM: ${llm.provider}` : ''})`,
    )
    for (const d of result.drafted)
      out(`  ${color('green', '+')} #${d.number} ${d.title} → ${d.path}`)
    for (const s of result.skipped)
      out(`  ${color('dim', `- #${s.number} ${s.title} (skipped: ${s.reason})`)}`)
    if (!result.files.length) {
      out('Nothing to draft.')
      return 0
    }
    if (values['dry-run']) {
      for (const file of result.files) out(`\n${color('bold', file.path)}\n${file.content}`)
      out(color('dim', '(dry run: nothing was written)'))
      return 0
    }
    for (const file of result.files) {
      const target = resolve(project.root, file.path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, file.content)
    }
    const n = result.drafted.length
    out(
      `${color('green', '✔')} Drafted ${n} entr${n === 1 ? 'y' : 'ies'}. Review them, then commit.`,
    )
    return 0
  } catch (error) {
    err(`${color('red', 'error')} ${(error as Error).message}`)
    return 1
  }
}

function detectRepo(cwd: string): string | undefined {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return parseRepo(remote)
  } catch {
    return undefined
  }
}

function ghToken(): string | undefined {
  try {
    return (
      execFileSync('gh', ['auth', 'token'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}

/** LLM options from SHIPDOT_LLM_* variables (and the config), or undefined for template mode. */
export function llmFromEnv(
  env: Record<string, string | undefined>,
  config: { provider?: LlmProvider; model?: string; baseUrl?: string } | undefined,
  warn: (message: string) => void = () => {},
  fetchImpl?: typeof fetch,
): LlmOptions | undefined {
  const provider = env.SHIPDOT_LLM_PROVIDER || config?.provider
  if (!provider) return undefined
  if (provider !== 'anthropic' && provider !== 'openai-compatible') {
    warn(`unknown SHIPDOT_LLM_PROVIDER "${provider}", using template mode`)
    return undefined
  }
  const apiKey = env.SHIPDOT_LLM_API_KEY
  if (!apiKey) {
    warn('SHIPDOT_LLM_API_KEY is not set, using template mode')
    return undefined
  }
  return {
    provider,
    apiKey,
    model: env.SHIPDOT_LLM_MODEL || config?.model,
    baseUrl: env.SHIPDOT_LLM_BASE_URL || config?.baseUrl,
    ...(fetchImpl && { fetch: fetchImpl }),
  }
}
