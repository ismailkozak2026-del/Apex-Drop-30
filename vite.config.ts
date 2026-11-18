import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = import.meta.dirname;

function kontrolRoutingPlugin(): Plugin {
  const applyMiddleware = (middlewares: {
    use: (
      fn: (
        req: { url?: string },
        res: { writeHead: (code: number, headers: Record<string, string>) => void; end: () => void },
        next: () => void
      ) => void
    ) => void;
  }) => {
    middlewares.use((req, res, next) => {
      const url = req.url || '/';
      const [pathname, search] = url.split('?');
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        res.writeHead(302, { Location: `/kontrol${search ? `?${search}` : ''}` });
        res.end();
        return;
      }
      if (pathname === '/kontrol' || pathname === '/kontrol/') {
        req.url = `/kontrol/index.html${search ? `?${search}` : ''}`;
      }
      next();
    });
  };

  return {
    name: 'kontrol-routing-redirect',
    configureServer(server) {
      applyMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      applyMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      kontrolRoutingPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'APEX DROP 30',
          short_name: 'APEX DROP',
          description: '30 kişilik 3D Akdeniz Villası aksiyon nişancı arenası.',
          theme_color: '#f59e0b',
          background_color: '#0d0f14',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/kontrol/, /^\/admin/],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, 'index.html'),
          kontrol: path.resolve(rootDir, 'kontrol/index.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three/')) return 'three-vendor';
            if (id.includes('node_modules/firebase/')) return 'firebase-vendor';
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/lucide-react/')) return 'icons-vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
