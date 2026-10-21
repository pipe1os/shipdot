---
"shipdot": patch
---

Widget fixes and polish: the popover opens above the trigger when it does not fit below (bells in footers or bottom bars); hotspots hide when their target scrolls out of an inner scroll container; a slotted custom trigger gets `aria-expanded` and `aria-haspopup`; when `src` changes quickly, a slower earlier response no longer replaces the newer feed; the popover, modal and hotspot tooltip fade in (skipped with `prefers-reduced-motion`).
