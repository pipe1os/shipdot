# shipdot + Next.js

A small Next.js app (a made-up analytics dashboard) with the `<ship-dot>` widget in its header and a hotspot on the "Export CSV" button. Live: https://pipe1os.github.io/shipdot/demo/next/

## Run it

From the repository root:

```sh
pnpm install
pnpm build:packages
pnpm --filter @shipdot/example-next dev
```

`dev` and `build` run `shipdot build` first, which compiles `.shipdot/entries/` into `public/shipdot.json`.

## How it is wired

- `shipdot.config.json`: entries folder, output folder and locales (`en`, `es`).
- `.shipdot/entries/`: one entry per update. `2026-10-14-export-csv.md` has `target: "#btn-export"`, so the widget puts a hotspot on that button. The `.es.md` file is its Spanish translation.
- `app/whats-new.jsx`: a client component that imports `shipdot` and renders `<ship-dot>`.
- `app/page.jsx`: renders `<WhatsNew />` in the header, which puts the widget there. The rest of the page (and `app/revenue-chart.jsx`) is scenery for the demo.
- `next.config.mjs`: `output: 'export'`, so `build` writes a static site to `out/`. The docs workflow builds it with `BASE_PATH=/shipdot/demo/next` and publishes it at https://pipe1os.github.io/shipdot/demo/next/.

`first-visit="show-latest"` keeps the newest entry unread on the first visit so you can see the badge and the hotspot right away. Clear the `shipdot:default` key in localStorage to see it again.
