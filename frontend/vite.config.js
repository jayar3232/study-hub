import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png', 'syncrova-logo.png', 'syncrova-app-logo.png'],
      manifest: {
        name: 'SYNCROVA',
        short_name: 'SYNCROVA',
        description: 'SYNCROVA workspace, messaging, reports, games, and team collaboration for NEMSU students.',
        theme_color: '#ec4899',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/syncrova-app-logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/syncrova-app-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
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
