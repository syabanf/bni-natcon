import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_API_PROXY in frontend/.env.local to point at a non-default API
// address (default backend ADDR is :8080).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Stamped into the service-worker URL so every deploy gets its own cache.
  // VITE_BUILD_ID lets CI pin it to a commit; otherwise the build time is
  // enough to tell one deploy from the next.
  const buildId = env.VITE_BUILD_ID || new Date().toISOString().slice(0, 16).replace(/\D/g, '')
  return {
    plugins: [react()],
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    server: {
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:8080',
        '/uploads': env.VITE_API_PROXY || 'http://localhost:8080',
      },
    },
    // The offline scan queue lives in localStorage, so the suite needs a
    // browser-shaped environment.
    test: {
      environment: 'jsdom',
      restoreMocks: true,
      // jsdom defaults to about:blank, an opaque origin where localStorage
      // does not exist — and the scan queue lives in localStorage.
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      setupFiles: ['./vitest.setup.js'],
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
