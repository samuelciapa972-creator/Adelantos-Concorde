import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Los puertos se pueden cambiar con WEB_PORT / API_PORT (los pasa `npm run dev` de la raíz).
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173)
const API_PORT = Number(process.env.API_PORT ?? 3001)

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: { plugins: [tailwindcss(), autoprefixer()] },
  },
  server: {
    port: WEB_PORT,
    strictPort: true, // si está ocupado, falla en vez de saltar a otro (rompería CORS)
    proxy: {
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
      '/uploads': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
})
