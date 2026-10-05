import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api requests go to the Express server.
    // Not used yet: src/api currently returns mock data.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
