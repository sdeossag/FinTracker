import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      padding: 0.05,
      resizeOptions: { background: '#0A0A0A', fit: 'contain' },
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: '#0A0A0A', fit: 'contain' },
    },
    favicon: {
      sizes: [64, 192, 512],
      padding: 0,
    },
  },
  images: ['public/pwa-source.svg'],
})
