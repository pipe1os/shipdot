---
"@shipdot/cli": patch
---

`shipdot init` prints `import 'shipdot'` instead of the CDN `<script>` when your `package.json` already depends on `shipdot`, and mentions the npm option otherwise.
