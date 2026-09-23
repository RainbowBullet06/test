import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

// Política de seguridad solo en la versión compilada (en desarrollo Vite necesita scripts en línea)
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  // http: permite conectarse a la computadora de la casa (red local) para sincronizar
  "font-src 'self' data:; connect-src 'self' data: blob: http:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"

export default defineConfig({
  // rutas relativas para que funcione dentro de Electron (file://)
  base: './',
  assetsInclude: ['**/*.docx'],
  build: { chunkSizeWarningLimit: 1500 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Evaluaciones de Comunicación',
        short_name: 'Evaluaciones',
        description: 'Apoyo para evaluaciones de comunicación verbal',
        lang: 'es-MX',
        theme_color: '#8A63E8',
        background_color: '#F6F2FF',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,docx}'] },
    }),
  ],
})
