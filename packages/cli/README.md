# @shipdot/cli

The `shipdot` command: compile Markdown entries into `shipdot.json` and `llms.txt`, and draft in-app release notes from merged pull requests.

```bash
npm install --save-dev @shipdot/cli
npx shipdot init       # shipdot.config.json + an example entry
npx shipdot build      # validate and write shipdot.json, llms.txt, llms-full.txt
npx shipdot validate   # file:line:column errors, exit code 1 on failure
npx shipdot draft      # draft entries from PRs merged since the last tag
```

`shipdot draft` works offline in template mode, or rewrites and translates drafts with your own LLM key (`SHIPDOT_LLM_PROVIDER=anthropic|openai-compatible`, `SHIPDOT_LLM_API_KEY`). Only pull request titles and bodies are sent.

Requires Node.js 24 or newer. Show the widget with [`shipdot`](https://www.npmjs.com/package/shipdot).

- [Documentation](https://pipe1os.github.io/shipdot/)
- [CLI reference](https://pipe1os.github.io/shipdot/reference/cli/)
- [Drafting from pull requests](https://pipe1os.github.io/shipdot/guides/drafting/)
- [Repository](https://github.com/pipe1os/shipdot)

MIT License
