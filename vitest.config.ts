import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Workspace packages resolve to their TypeScript sources, so tests never need a build first.
const alias = {
  '@shipdot/core/compile': src('./packages/core/src/compile.ts'),
  '@shipdot/core': src('./packages/core/src/index.ts'),
  '@shipdot/cli': src('./packages/cli/src/index.ts'),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: 'core', include: ['packages/core/test/**/*.test.ts'] } },
      { resolve: { alias }, test: { name: 'cli', include: ['packages/cli/test/**/*.test.ts'] } },
      {
        resolve: { alias },
        test: {
          name: 'shipdot',
          include: ['packages/shipdot/test/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      { resolve: { alias }, test: { name: 'action', include: ['action/test/**/*.test.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'action/src/**'],
      reporter: ['text', 'html'],
    },
  },
})
