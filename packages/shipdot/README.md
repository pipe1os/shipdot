# shipdot

`<ship-dot>`: a zero-dependency web component for in-app changelogs and **feature hotspots**. About 6.5 KB min+gzip.

```html
<script type="module" src="https://unpkg.com/shipdot@0.1"></script>
<ship-dot src="/shipdot.json"></ship-dot>
```

Or `npm install shipdot` and import it once on the client:

```js
import 'shipdot'
```

It shows a bell with an unread count and a "What's new" panel (popover, drawer or modal). Entries with a `target` selector put a pulsing hotspot on that element of your UI. Read state is stored in the user's `localStorage`; the widget makes no request other than fetching `src`.

Create `shipdot.json` with [`@shipdot/cli`](https://www.npmjs.com/package/@shipdot/cli):

```bash
npx @shipdot/cli init
npx @shipdot/cli build
```

## Attributes

`src` (required), `mode` (`popover` | `drawer` | `modal`), `locale`, `theme` (`light` | `dark` | `auto`), `hotspots` (`off` to disable), `max-hotspots`, `first-visit` (`mark-read` | `show-latest`), `storage-key`.

**Methods**: `open()`, `close()`, `markAllRead()`, `markRead(ids)`, `replayLatest()`, `refresh()`.
**Events**: `shipdot:ready`, `shipdot:open`, `shipdot:close`, `shipdot:read`, `shipdot:hotspot-click`, `shipdot:error`.

Typings for frameworks: `import type {} from 'shipdot/react'` (also `shipdot/vue`, `shipdot/svelte`, `shipdot/astro`).

## Links

- [Documentation](https://pipe1os.github.io/shipdot/)
- [Widget reference](https://pipe1os.github.io/shipdot/reference/widget/)
- [Playground](https://pipe1os.github.io/shipdot/playground/)
- [Repository](https://github.com/pipe1os/shipdot)

MIT License
