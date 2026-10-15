---
"@shipdot/core": patch
---

`stripHtmlComments` finds comments with a linear-time scanner instead of the Markdown parser, which took quadratic time on deeply nested lists and block quotes: a 65 KB pull request body could stall `shipdot draft` and the GitHub Action for minutes. Comments are still removed the way GitHub renders them, and `<!--` in code spans and code blocks is kept.
