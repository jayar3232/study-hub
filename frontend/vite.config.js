import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localBackendProxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    secure: false,
  },
  '/socket.io': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    ws: true,
    secure: false,
  },
  '/uploads': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    secure: false,
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: localBackendProxy
  },
  preview: {
    host: '0.0.0.0',
    proxy: localBackendProxy
  }
})
