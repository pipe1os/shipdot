---
"@shipdot/core": patch
"@shipdot/cli": patch
---

Harden parsing of untrusted text: HTML comments are removed in one linear pass that never leaves a `<!--` behind (exported as `stripHtmlComments` from `@shipdot/core/compile`), and `shipdot draft` parses pull request titles and bodies without regular expressions that can backtrack polynomially.
