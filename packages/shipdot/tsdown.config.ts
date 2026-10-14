import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { shipdot: 'src/index.ts' },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  dts: true,
  fixedExtension: false,
  deps: { alwaysBundle: ['@shipdot/core'] },
})
