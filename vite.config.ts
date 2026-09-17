import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo under /cadre/, not the domain root; the
  // deploy workflow sets VITE_BASE_PATH for that build only. Self-hosted
  // deploys are unaffected and still default to root.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.spec.ts'],
  },
})
