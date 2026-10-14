import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/compile.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
})
