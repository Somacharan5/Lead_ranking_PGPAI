import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor libs in their own chunk → cached across deploys
          react: ['react', 'react-dom', 'react-router-dom'],
          // Charting lib is admin-only and large; keep it isolated
          recharts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
