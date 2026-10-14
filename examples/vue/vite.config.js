import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // Tell Vue that <ship-dot> is a custom element, not a Vue component.
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'ship-dot',
        },
      },
    }),
  ],
})
