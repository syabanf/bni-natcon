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
        '/uploads': env.VITE_API_PROXY || 'http://localhost:8080',
      },
    },
    // Component tests opt into jsdom per file with a
    // `@vitest-environment jsdom` docblock. It is not the default because
    // jsdom's File has no arrayBuffer(), which the spreadsheet round-trip
    // tests rely on.
    test: {
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
