import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import geminiHandler from './api/gemini.js';

function geminiLocalProxyPlugin() {
  const attach = (server) => {
    server.middlewares.use('/api/gemini', async (req, res) => {
      try {
        let rawBody = '';
        for await (const chunk of req) {
          rawBody += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
        }
        let body = {};
        if (rawBody) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        }
        const mockReq = { method: req.method, headers: req.headers, body };
        const mockRes = {
          setHeader: (k, v) => res.setHeader(k, v),
          status: (code) => {
            res.statusCode = code;
            return {
              json: (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
              end: () => res.end(),
            };
          },
        };
        await geminiHandler(mockReq, mockRes);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err?.message || 'Server error' }));
      }
    });
  };

  return {
    name: 'gemini-local-proxy',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }

  return {
    base: './',
    plugins: [
      react(),
      geminiLocalProxyPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['siegel_bunt.png', 'pwa_icon_192.png', 'pwa_icon_512.png', 'favicon.ico'],
        manifest: {
          name: 'Heimbürgeschule Schul-Übersetzer',
          short_name: 'Schul-Übersetzer',
          description:
            'Pädagogische Offline- & Online-Übersetzer App für die Staatliche Regelschule Heimbürgeschule Kahla',
          theme_color: '#0B7BA7',
          background_color: '#FFFBF5',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          icons: [
            {
              src: '/pwa_icon_192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/pwa_icon_512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
  };
});
