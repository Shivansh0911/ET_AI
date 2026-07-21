import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Split the heavy libraries out so the first paint does not wait on the map projection
    // code or the markdown parser, and so a UI change does not invalidate their cache entry.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
          maps: ['react-simple-maps'],
          markdown: ['react-markdown'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: { port: 5173 },
})
