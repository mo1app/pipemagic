import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3005,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/editor': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/editor/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['pipemagic'],
  },
})
