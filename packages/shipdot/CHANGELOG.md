# shipdot

## 0.2.0

### Minor Changes

- [#42](https://github.com/pipe1os/shipdot/pull/42) [`1305bae`](https://github.com/pipe1os/shipdot/commit/1305baed5771ba79ddec5980e9bb3395382fd85b) Thanks [@pipe1os](https://github.com/pipe1os)! - Feed panel improvements: an "Earlier" divider between unread and read entries, an error message (with a retry) when `src` fails to load instead of a trigger that does nothing, and live re-rendering when a refresh or locale change happens while the panel is open. The built-in bell now has an accessible name before the feed loads. New UI strings: `earlier`, `error`.

- [#37](https://github.com/pipe1os/shipdot/pull/37) [`e8290e5`](https://github.com/pipe1os/shipdot/commit/e8290e5a28fd0e5efa9221f515fe1e74e8a76de5) Thanks [@pipe1os](https://github.com/pipe1os)! - The widget fetches `src` again when a tab comes back to the foreground 10 minutes or more after the last load, so tabs left open for days see new entries. Every fetch revalidates with the server (`cache: 'no-cache'`), so an unchanged feed costs a `304`.

- [#35](https://github.com/pipe1os/shipdot/pull/35) [`ddc75e9`](https://github.com/pipe1os/shipdot/commit/ddc75e9bfbc370d6f369ad91ebc3ef908f2e0360) Thanks [@pipe1os](https://github.com/pipe1os)! - Read state syncs across tabs and widgets. Reading entries in one tab clears the badge and hotspots in the others, and widgets on the same page with the same `storage-key` share read state and draw each hotspot once. Uses a `BroadcastChannel` named after the storage key, so it also works without `localStorage`. `shipdot:read` fires only in the widget where the entries were read.

### Patch Changes

- [#42](https://github.com/pipe1os/shipdot/pull/42) [`1305bae`](https://github.com/pipe1os/shipdot/commit/1305baed5771ba79ddec5980e9bb3395382fd85b) Thanks [@pipe1os](https://github.com/pipe1os)! - The badge, the unread dot and hotspot dots stay visible in forced colors mode (Windows High Contrast). Before, they were painted with the page background.

- [#34](https://github.com/pipe1os/shipdot/pull/34) [`6e791a1`](https://github.com/pipe1os/shipdot/commit/6e791a145c00aac6524a1e8d17b1b59829c5aeef) Thanks [@pipe1os](https://github.com/pipe1os)! - Hotspots follow targets that move without a scroll or resize, such as content inserted above them or a CSS transition. Reading one entry no longer rebuilds the other hotspots, so their pulse does not restart and an open tooltip stays open.

- [#28](https://github.com/pipe1os/shipdot/pull/28) [`8510a37`](https://github.com/pipe1os/shipdot/commit/8510a378e702f4ab6f15044fdea04baf2bc19b13) Thanks [@pipe1os](https://github.com/pipe1os)! - `markRead(ids)` marks entries as read by ID, so an app with user accounts can sync read state across devices: store the IDs from `shipdot:read` on your server and pass them back. It can be called before the feed loads.

- [#38](https://github.com/pipe1os/shipdot/pull/38) [`afe02f4`](https://github.com/pipe1os/shipdot/commit/afe02f4f6c10e4d26b093cf08c98262846306520) Thanks [@pipe1os](https://github.com/pipe1os)! - A popover opened above the trigger, and a hotspot tooltip opened above its target, no longer grow down over them when images finish loading. Hotspots pick up `--shipdot-*` properties and `color-scheme` the app changes after load, for example when it switches to dark mode with a class on `<html>`.

- [#36](https://github.com/pipe1os/shipdot/pull/36) [`5836781`](https://github.com/pipe1os/shipdot/commit/5836781571bce091857b9190fbaf1b6fd7c2ce00) Thanks [@pipe1os](https://github.com/pipe1os)! - The popover closes when Tab moves focus out of it, and focus stays where it went. Before, it stayed open and a later Esc anywhere sent focus back to the trigger.

- [#33](https://github.com/pipe1os/shipdot/pull/33) [`962cca3`](https://github.com/pipe1os/shipdot/commit/962cca34e1716f3ca01fb7ec886310fbe9c82752) Thanks [@pipe1os](https://github.com/pipe1os)! - Widget fixes and polish: the popover opens above the trigger when it does not fit below (bells in footers or bottom bars); hotspots hide when their target scrolls out of an inner scroll container; a slotted custom trigger gets `aria-expanded` and `aria-haspopup`; when `src` changes quickly, a slower earlier response no longer replaces the newer feed; the popover, modal and hotspot tooltip fade in (skipped with `prefers-reduced-motion`).

## 0.1.1

### Patch Changes

- [#10](https://github.com/pipe1os/shipdot/pull/10) [`d48d06b`](https://github.com/pipe1os/shipdot/commit/d48d06be935c5db5233b0f409f27a999840ffeeb) Thanks [@pipe1os](https://github.com/pipe1os)! - Builds are reproducible across operating systems: the GitHub Action bundle is byte-identical on Linux, macOS and Windows, `pnpm build` no longer leaves the working tree dirty, and releases are published from CI with npm trusted publishing.

## 0.1.0

### Minor Changes

- [#2](https://github.com/pipe1os/shipdot/pull/2) [`7d06b19`](https://github.com/pipe1os/shipdot/commit/7d06b19b1cb0416085bf54d6d82fd78b39eeaaf9) Thanks [@pipe1os](https://github.com/pipe1os)! - First release: the `<ship-dot>` web component with feed panel, unread badge and hotspots; `@shipdot/cli` with `init`, `build`, `validate` and `draft` (template and LLM modes); `@shipdot/core` with the shipdot.json v1 schema, validation and the compile pipeline.
