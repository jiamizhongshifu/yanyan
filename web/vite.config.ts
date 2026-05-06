/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Soak',
        short_name: 'Soak',
        description: '控糖 × 炎症 × 次晨体感',
        theme_color: '#F7F4EE',
        background_color: '#F7F4EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // 排除大体积非首屏关键 chunk(matter.js)从 precache;首次进入有勋章的 Insights 页时
        // 走网络下载,然后命中 runtime image cache。其它 lazy chunk 保留 precache 以支持离线。
        globIgnores: ['**/AchievementJarPhysics-*.js'],
        runtimeCaching: [
          {
            // API 请求 — network-first + 5s timeout
            urlPattern: /\/api\/v1\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'yanyan-api', networkTimeoutSeconds: 5 }
          },
          {
            // 图片资源(hero / mascot / badge / icon)— cache-first,30 天有效
            // 这些 PNG/SVG/JPG 来自 dist/* 或 Supabase app-assets bucket
            urlPattern: ({ request, url }) =>
              request.destination === 'image' ||
              /\.(?:png|jpg|jpeg|svg|gif|webp|avif)(?:\?|$)/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'yanyan-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // 矩阵物理引擎 chunk(从 precache 排除)首次走网络,后续走缓存
            urlPattern: /\/assets\/AchievementJarPhysics-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'yanyan-lazy-js',
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'tests', 'server', 'api', 'scripts', 'dist']
  }
});
