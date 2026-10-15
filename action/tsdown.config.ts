import { defineConfig } from 'tsdown'

// One self-contained file: the Action runs straight from the repository, without installing.
export default defineConfig({
  entry: { index: 'src/main.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  fixedExtension: false,
  dts: false,
  minify: false,
  deps: { alwaysBundle: [/.*/] },
  // No `//#region <path>` comments: they embed node_modules/.pnpm paths, which depend on the
  // local pnpm store layout, so the bundle would not be byte-identical across machines
  // (docs/adr/0005-reproducible-builds.md).
  inputOptions: { experimental: { attachDebugInfo: 'none' } },
})
