# @shipdot/core

## 0.1.1

### Patch Changes

- [#11](https://github.com/pipe1os/shipdot/pull/11) [`7b38259`](https://github.com/pipe1os/shipdot/commit/7b38259be40c29ea9c103b0fee5f3ead516335ea) Thanks [@pipe1os](https://github.com/pipe1os)! - Harden parsing of untrusted text: HTML comments are removed with the Markdown parser instead of a regular expression (exported as `stripHtmlComments` from `@shipdot/core/compile`), so `<!--` written in code no longer cuts off `llms.txt` or a pull request's `### shipdot` section, and `shipdot draft` parses pull request titles and bodies without regular expressions that can backtrack polynomially.

## 0.1.0

### Minor Changes

- [#2](https://github.com/pipe1os/shipdot/pull/2) [`7d06b19`](https://github.com/pipe1os/shipdot/commit/7d06b19b1cb0416085bf54d6d82fd78b39eeaaf9) Thanks [@pipe1os](https://github.com/pipe1os)! - First release: the `<ship-dot>` web component with feed panel, unread badge and hotspots; `@shipdot/cli` with `init`, `build`, `validate` and `draft` (template and LLM modes); `@shipdot/core` with the shipdot.json v1 schema, validation and the compile pipeline.
