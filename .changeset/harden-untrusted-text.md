---
"@shipdot/core": patch
"@shipdot/cli": patch
---

Harden parsing of untrusted text: HTML comments are removed with the Markdown parser instead of a regular expression (exported as `stripHtmlComments` from `@shipdot/core/compile`), so `<!--` written in code no longer cuts off `llms.txt` or a pull request's `### shipdot` section, and `shipdot draft` parses pull request titles and bodies without regular expressions that can backtrack polynomially.
