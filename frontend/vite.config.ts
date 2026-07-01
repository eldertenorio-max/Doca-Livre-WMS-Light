import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'pwa/icon-192.png', 'pwa/icon-512.png'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    // Garante que dev/proxy também não bloqueie o host
    allowedHosts: true,
  },
  preview: {
    // Permite que o Vite Preview aceite o domínio do Render
    // (evita erro: host ... not allowed).
    // (nota: isso é necessário porque o Render usa um Host diferente do localhost)
    allowedHosts: true,
  },
})
