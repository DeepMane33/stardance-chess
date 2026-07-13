import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js']
  }
})