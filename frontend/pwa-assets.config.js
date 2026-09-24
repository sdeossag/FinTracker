import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // El ícono ya es un cuadrado a sangre: sin márgenes (iOS redondea las esquinas)
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: '#0A84FF', fit: 'contain' },
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: '#0A84FF', fit: 'contain' },
    },
    favicon: {
      sizes: [64, 192, 512],
      padding: 0,
    },
  },
  images: ['public/pwa-source.svg'],
})
