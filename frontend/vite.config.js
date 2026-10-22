import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api requests to the Express server during development.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
