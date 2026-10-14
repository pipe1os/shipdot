# shipdot + Astro

A minimal Astro app with the `<ship-dot>` widget and a hotspot on the "Export CSV" button.

## Run it

From the repository root:

```sh
pnpm install
pnpm build:packages
pnpm --filter @shipdot/example-astro dev
```

`dev` and `build` run `shipdot build` first, which compiles `.shipdot/entries/` into `public/shipdot.json`.

## How it is wired

- `shipdot.config.json`: entries folder, output folder and locales (`en`, `es`).
- `.shipdot/entries/`: one entry per update. `2026-10-14-export-csv.md` has `target: "#btn-export"`, so the widget puts a hotspot on that button. The `.es.md` file is its Spanish translation.
- `src/pages/index.astro`: renders `<ship-dot>` in the header and imports `shipdot` in a page script.

`first-visit="show-latest"` keeps the newest entry unread on the first visit so you can see the badge and the hotspot right away. Clear the `shipdot:default` key in localStorage to see it again.
