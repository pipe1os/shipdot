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
})
