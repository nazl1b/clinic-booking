import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api requests go to the Express server (server/, port 3000).
    // src/api still returns mock data until it is switched to real fetch calls.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
