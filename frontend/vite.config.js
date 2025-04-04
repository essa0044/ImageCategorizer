import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 3000, // Optional: Define dev server port
    proxy: {
      // Proxy /api requests to the backend server
      '/api': {
        target: 'http://exam-backend:5001', // Backend-Server (as in Flask or Docker Compose)
        changeOrigin: true, // Needed for virtual hosted sites
        // secure: false, // if Backend has no HTTPS
        // rewrite: (path) => path.replace(/^\/api/, '') // Optional: rewrite path if needed
      },
      // proxy other endpoints if needed
      // '/api/images': {
      //   target: 'http://localhost:5001',
      //   changeOrigin: true,
      // }
    }
  }
})
