import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_API_PROXY in frontend/.env.local to point at a non-default API
// address (default backend ADDR is :8080).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:8080',
        '/uploads': env.VITE_API_PROXY || 'http://localhost:8080',
      },
    },
    // `vite preview` serves the production bundle and does NOT reuse
    // server.proxy — mirror it so the built app can be checked locally
    // against the same API.
    preview: {
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:8080',
        '/uploads': env.VITE_API_PROXY || 'http://localhost:8080',
      },
    },
  }
})
