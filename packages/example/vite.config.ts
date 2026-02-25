import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3005,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['pipemagic'],
  },
})
