import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    // dev backend: PORT=8090, so it doesn't clash with Hisaab on 8080
    // /oauth2 and /login/oauth2: the OIDC sign-in redirects, handled by the backend
    proxy: { '/api': 'http://localhost:8090', '/oauth2': 'http://localhost:8090', '/login/oauth2': 'http://localhost:8090' },
  },
})
