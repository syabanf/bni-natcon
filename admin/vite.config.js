import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_API_PROXY in admin/.env.local to point at a non-default API
// address (default backend ADDR is :8080).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:8080',
      },
    },
  }
})
