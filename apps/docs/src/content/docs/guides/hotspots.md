---
title: Hotspots
description: Put a pulsing dot on the real UI element a new feature lives in.
---

A hotspot is shipdot's signature feature: when an **unread** entry has a `target`, the widget finds that element on the page and draws a pulsing dot on its top-right corner. Clicking the dot (or pressing Enter on it) opens a tooltip with the note. **Got it** marks the entry as read and removes the dot.

```md
---
date: 2026-10-14
type: new
title: Export to Excel
target: "#btn-export"
---
```

## Choosing a selector

`target` is any CSS selector accepted by `document.querySelector`. The first match is used. Prefer selectors that survive refactors:

- An `id`: `#btn-export`.
- A dedicated data attribute: `[data-shipdot="export"]`. This makes the intent obvious to whoever touches that markup later.

Avoid generated class names (CSS modules, Tailwind utility soup); they change between builds.

## Behavior

- **Only unread entries** get hotspots. Opening the feed panel marks everything as read, which also removes the dots.
- At most `max-hotspots` dots are visible at once (default 3), newest first.
- The dot is **hidden** while its target is not visible: `display: none`, `visibility: hidden`, zero size, or scrolled out of the viewport or out of a scroll container (a sidebar, a pane with `overflow: auto`). When the target is partly scrolled out, the dot sits on the corner that is still visible.
- It **follows the target** on scroll, resize and layout changes: a ResizeObserver, scroll and resize listeners, a MutationObserver for content inserted around the target, and `transitionend`/`animationend` for elements that slide into place. All of them share one `requestAnimationFrame`, so the dots are laid out at most once per frame. During a CSS transition the dot moves when the transition ends.
- **Late targets** are supported: in single-page apps the element can appear after navigation, and the same MutationObserver picks it up.
- Reading one entry does not rebuild the other dots, so their pulse and an open tooltip are left alone.
- **Keyboard**: dots are real `<button>`s. Enter opens the tooltip, Esc closes it and returns focus to the dot.
- **Motion**: with `prefers-reduced-motion: reduce` the pulse animation is replaced by a static ring.
- An invalid selector dispatches a `shipdot:error` event and is ignored.

Hotspots live in their own fixed layer at the end of `<body>`, with its own shadow root, so `overflow: hidden` or transformed ancestors in your app never clip or shift them.

## Turning them off

```html
<ship-dot src="/shipdot.json" hotspots="off"></ship-dot>
<ship-dot src="/shipdot.json" max-hotspots="1"></ship-dot>
```

## Styling

The layer copies the widget's [custom properties](/shipdot/guides/theming/). Dots use `--shipdot-hotspot` (pink by default, so they stand out on brand-colored buttons); tooltips use the rest of the theme. For deeper changes, target the layer's parts:

```css
.shipdot-layer::part(hotspot) { /* the dot button */ }
.shipdot-layer::part(tooltip) { /* the tooltip */ }
.shipdot-layer::part(got-it) { /* the "Got it" button */ }
```

## Limitations

- Elements inside other components' shadow roots or inside iframes can't be targeted (`document.querySelector` does not reach them).
- Hotspots are tab-ordered at the end of the page, after your content.
