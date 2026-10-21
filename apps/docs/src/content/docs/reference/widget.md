---
title: Widget reference
description: Attributes, properties, methods, events, slots, parts and browser support of <ship-dot>.
---

```html
<script type="module" src="https://unpkg.com/shipdot@0.1"></script>
<ship-dot src="/shipdot.json"></ship-dot>
```

Importing `shipdot` registers the `<ship-dot>` custom element. The import is safe during server-side rendering (it does nothing there). The package has **zero runtime dependencies** and weighs about **6.5 KB min+gzip**; CI fails above 10 KB.

## Attributes

| Attribute | Default | Description |
| --- | --- | --- |
| `src` | — (required) | URL of `shipdot.json`, relative to the page. It is the only request the widget makes. |
| `mode` | `popover` | `popover`, `drawer` or `modal`. |
| `locale` | `navigator.languages` | Language to show. See [i18n](/shipdot/guides/i18n/). |
| `theme` | `auto` | `light`, `dark` or `auto` (follows `prefers-color-scheme`). |
| `hotspots` | on | `off` disables [hotspots](/shipdot/guides/hotspots/). |
| `max-hotspots` | `3` | Maximum hotspots visible at once. |
| `first-visit` | `mark-read` | What a first-time user sees. `mark-read`: everything already published counts as read. `show-latest`: the newest entry stays unread. |
| `storage-key` | `default` | Read state is stored in `localStorage` under `shipdot:<storage-key>`. Use different keys for widgets with different feeds. |

The element reflects the unread count in `data-unread`.

## Properties and methods

| Member | Description |
| --- | --- |
| `entries` | All entries of the loaded feed, newest first (read-only). |
| `unread` | Unread entries, newest first (read-only). |
| `open()` | Opens the panel and marks every entry as read. |
| `close()` | Closes the panel and returns focus to the trigger. |
| `markAllRead()` | Marks every entry as read, clearing the badge and the hotspots. |
| `markRead(ids)` | Marks the entries with these IDs as read. Works before the feed loads. See [Syncing read state across devices](#syncing-read-state-across-devices). |
| `replayLatest()` | Marks the newest entry as unread again, bringing back its badge and hotspot. Handy for a "What's new?" link. |
| `refresh()` | Fetches `src` again and re-renders. Returns a promise. |

```js
const widget = document.querySelector('ship-dot')
document.querySelector('#whats-new-link').addEventListener('click', () => widget.open())
```

## Events

All events are `CustomEvent`s that bubble and cross shadow roots (`composed`), so you can listen on `document`.

| Event | `detail` | When |
| --- | --- | --- |
| `shipdot:ready` | `{ entries, unread, locale }` | The feed loaded (after every `refresh()`). |
| `shipdot:open` | `{ mode }` | The panel opened. |
| `shipdot:close` | `{ mode }` | The panel closed. |
| `shipdot:read` | `{ ids }` | Entries were marked as read. |
| `shipdot:hotspot-click` | `{ id }` | A hotspot was clicked or activated with the keyboard. |
| `shipdot:error` | `{ error }` | The feed could not be loaded or a `target` selector is invalid. |

```js
document.addEventListener('shipdot:read', (event) => {
  console.log('read', event.detail.ids)
})
```

## Slot, parts and custom properties

- The **default slot** replaces the bell with your own trigger. See [Theming](/shipdot/guides/theming/#your-own-trigger).
- **Parts**: `trigger`, `badge`, `panel`, `header`, `close`, `list`, `entry`, `entry-title`, `tag`, `image`, `body`, `link`, and on the hotspot layer (`.shipdot-layer`) `hotspot`, `tooltip`, `got-it`.
- **Custom properties**: `--shipdot-accent`, `--shipdot-accent-contrast`, `--shipdot-hotspot`, `--shipdot-bg`, `--shipdot-fg`, `--shipdot-muted`, `--shipdot-border`, `--shipdot-radius`, `--shipdot-shadow`, `--shipdot-font`, `--shipdot-panel-width`, `--shipdot-trigger-size`, `--shipdot-z`. Defaults in [Theming](/shipdot/guides/theming/#custom-properties).

## Read state and privacy

The IDs of read entries are stored in `localStorage` (only IDs still present in the feed, at most 500). Every access is wrapped in `try/catch`: in private mode, with storage disabled, or in a sandboxed iframe, the widget works the same and keeps read state in memory for the session. Nothing is sent anywhere.

### Tabs and widgets on the same page

Reads reach every open tab of your site and every other `<ship-dot>` on the page with the same `storage-key`, through a [`BroadcastChannel`](https://developer.mozilla.org/docs/Web/API/BroadcastChannel) named after the key. This works without `localStorage` too and never leaves the browser. Only the widget where the entries were read fires `shipdot:read`, so a sync handler like the one below runs once per read. When two widgets share a key (say, one in the desktop header and one in the mobile menu), only the first one draws hotspots; if it is removed, the other takes over.

### Syncing read state across devices

Read state lives on one device. If your app has user accounts, it can carry read state between devices on its own: save the IDs from `shipdot:read` and hand them back with `markRead()`.

```html
<script type="module">
  await customElements.whenDefined('ship-dot')
  const widget = document.querySelector('ship-dot')

  // Save what the user reads on this device.
  widget.addEventListener('shipdot:read', (event) => {
    fetch('/api/me/shipdot-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event.detail.ids),
    })
  })

  // Mark what they read on other devices. This can run before the feed loads.
  const res = await fetch('/api/me/shipdot-read')
  if (res.ok) widget.markRead(await res.json())
</script>
```

`/api/me/shipdot-read` stands for an endpoint of your own app that adds the posted IDs to a set per user and returns that set. Read state only grows, so merging devices is a union and never conflicts. `shipdot:read` also fires for the IDs you pass to `markRead()` that this device had not read yet; a set ignores the ones it already has. `replayLatest()` only affects the current widget.

shipdot itself still sends nothing: the requests above are your app's, to your server.

## Accessibility

- The trigger is a `<button>` whose accessible name includes the unread count ("What's new (2 unread)"), with `aria-expanded` and `aria-haspopup="dialog"`.
- The panel is a labeled dialog. Drawer and modal use a native modal `<dialog>`: focus is trapped inside, Esc closes it, and focus returns to the trigger. The popover closes on Esc, an outside click, or when Tab moves focus out of it (focus stays where it went).
- Unread entries are announced with visually hidden text, not only by color.
- Hotspots are keyboard-reachable buttons; tooltips are labeled dialogs.
- Both themes meet WCAG 2.1 AA contrast. axe runs on every panel mode and theme in CI.
- `prefers-reduced-motion` disables the pulse and slide animations.

## Browser support

Chrome and Edge 123+, Firefox 125+, Safari 17.5+. The widget relies on the Popover API, `<dialog>`, Shadow DOM, `light-dark()` and `color-mix()`.

## TypeScript and frameworks

The package ships types for the element (`ShipDot`, `ShipDotAttributes`, `ShipDotEventMap`, `Feed`, `FeedEntry`) and registers `ship-dot` in `HTMLElementTagNameMap`. JSX and template typings are opt-in per framework:

```ts
import type {} from 'shipdot/react' // React 19+
import type {} from 'shipdot/vue' // Vue 3
import type {} from 'shipdot/svelte' // Svelte 5
import type {} from 'shipdot/astro' // Astro
```
