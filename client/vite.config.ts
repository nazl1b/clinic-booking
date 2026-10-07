import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api requests go to the Express server (server/, port 3000),
    // so the page and the API share one origin and the session cookie just works.
    // Online, Express serves the built client itself (same domain, no proxy).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
