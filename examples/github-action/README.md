# shipdot GitHub Action

[`shipdot.yml`](shipdot.yml) drafts in-app release notes every Monday and opens a pull request with them.

1. Copy `shipdot.yml` to `.github/workflows/shipdot.yml`.
2. Make sure `shipdot.config.json` exists (`npx @shipdot/cli init`).
3. Enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**.
4. Optional LLM mode: add a `SHIPDOT_LLM_API_KEY` secret and uncomment the two `llm-` lines. Only pull request titles and bodies are sent to the provider.

Run it once from the **Actions** tab (`workflow_dispatch`) to try it. The pull request lists every drafted and skipped pull request; edit the drafts, add a `target` for hotspots, and merge.

Inputs, outputs and security notes: [GitHub Action guide](https://pipe1os.github.io/shipdot/guides/github-action/).
