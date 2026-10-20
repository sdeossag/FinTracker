import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker propio (src/sw.js): la página va primero a la red,
      // el resto del app shell sale del precache, y maneja las notificaciones push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',

      // El manifest lo manejamos manualmente en public/manifest.webmanifest
      manifest: false,

      // Habilitar SW en desarrollo para poder probar offline
      devOptions: {
        enabled: true,
        type: 'module',
      },

      injectManifest: {
        // Sin html: index.html no sale del precache, se pide a la red (ver src/sw.js)
        globPatterns: ['**/*.{js,css,svg,png,ico,woff,woff2}'],
      },
    }),
  ],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
