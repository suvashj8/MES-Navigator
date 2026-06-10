import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const devPorts = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../dev-ports.json'), 'utf8')
) as { api: number; ui: number };

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Navigator Bead for Life MES',
        short_name: 'MES',
        description: 'Mobile-first production entry and grading',
        theme_color: '#0f172a',
        background_color: '#f4f7f9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/favicon.svg', sizes: '48x46', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    port: devPorts.ui,
    strictPort: true,
    // Listen on all network interfaces so colleagues on the same Wi‑Fi can open the app
    host: true,
    proxy: {
      '/api': `http://localhost:${devPorts.api}`,
    },
  },
});
