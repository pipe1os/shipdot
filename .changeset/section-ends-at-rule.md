---
"@shipdot/cli": patch
---

`shipdot draft`: the `### shipdot` section of a pull request now also ends at a horizontal rule (`---`), so footers that tools append to the description no longer leak into the in-app note.
