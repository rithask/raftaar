import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    // dev backend: PORT=8090, so it doesn't clash with Hisaab on 8080
    proxy: { '/api': 'http://localhost:8090' },
  },
})
