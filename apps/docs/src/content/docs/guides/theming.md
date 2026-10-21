---
title: Theming
description: Light and dark themes, CSS custom properties, ::part() selectors and a custom trigger.
---

## Light, dark or automatic

```html
<ship-dot src="/shipdot.json" theme="auto"></ship-dot>  <!-- default: follows the OS -->
<ship-dot src="/shipdot.json" theme="dark"></ship-dot>
```

If your app has its own theme toggle, set the attribute from it. Both built-in themes meet WCAG 2.1 AA contrast, verified with axe in CI.

## Custom properties

Set them on `ship-dot` or on `:root`. Values can use `light-dark()` to adapt to the theme.

| Property | Default (light / dark) | What it styles |
| --- | --- | --- |
| `--shipdot-accent` | `#4f46e5` / `#a5b4fc` | Badge, unread dot, links, "Got it" |
| `--shipdot-accent-contrast` | `#fff` / `#18181b` | Text on the accent color |
| `--shipdot-hotspot` | `#db2777` / `#f472b6` | Hotspot dots (distinct from the accent so they stand out on brand-colored buttons) |
| `--shipdot-bg` | `#fff` / `#18181b` | Panel and tooltip background |
| `--shipdot-fg` | `#18181b` / `#f4f4f5` | Text |
| `--shipdot-muted` | `#52525b` / `#a1a1aa` | Dates and secondary text |
| `--shipdot-border` | `#e4e4e7` / `#3f3f46` | Borders and separators |
| `--shipdot-radius` | `12px` | Panel and tooltip corners |
| `--shipdot-shadow` | `0 12px 32px rgb(0 0 0 / .2)` | Panel and tooltip shadow |
| `--shipdot-font` | `400 14px/1.5 system-ui, sans-serif` | Font shorthand |
| `--shipdot-panel-width` | `380px` (popover), `420px` (drawer) | Panel width |
| `--shipdot-trigger-size` | `40px` | Bell button size |
| `--shipdot-z` | `2147483000` | z-index of the hotspot layer |

```css
ship-dot {
  --shipdot-accent: light-dark(#0f766e, #5eead4);
  --shipdot-radius: 6px;
  color: #334155; /* the bell icon uses currentColor */
}
```

If you change colors, keep text contrast at 4.5:1 or more.

## Parts

Every key piece is exposed with `::part()`:

```css
ship-dot::part(trigger) {}   /* the bell button */
ship-dot::part(badge) {}     /* unread count */
ship-dot::part(panel) {}     /* popover, drawer or modal */
ship-dot::part(header) {}
ship-dot::part(close) {}
ship-dot::part(list) {}
ship-dot::part(entry) {}
ship-dot::part(entry-title) {}
ship-dot::part(tag) {}
ship-dot::part(image) {}
ship-dot::part(body) {}
ship-dot::part(link) {}
.shipdot-layer::part(hotspot) {}
.shipdot-layer::part(tooltip) {}
.shipdot-layer::part(got-it) {}
```

## Panel mode

```html
<ship-dot src="/shipdot.json" mode="popover"></ship-dot> <!-- default, anchored to the bell -->
<ship-dot src="/shipdot.json" mode="drawer"></ship-dot>  <!-- slides in from the side -->
<ship-dot src="/shipdot.json" mode="modal"></ship-dot>   <!-- centered dialog -->
```

Drawer and modal use a native `<dialog>`: the rest of the page becomes inert, focus stays inside, Esc closes it and focus returns to the trigger.

## Your own trigger

Anything you put inside `<ship-dot>` replaces the bell. Clicking it toggles the panel. The element gets a `data-unread` attribute with the count, so you can style your own badge:

```html
<ship-dot src="/shipdot.json">
  <button type="button" class="nav-link">What's new</button>
</ship-dot>

<style>
  ship-dot:not([data-unread='0']) .nav-link::after { content: '•'; color: crimson; }
</style>
```

Give your button an accessible name that mentions new updates when there are any. The widget sets `aria-haspopup` and `aria-expanded` on it when the panel opens and closes.
