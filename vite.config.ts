import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: 'app',
  plugins: [react()],
  define: { global: 'globalThis' },
  resolve: {
    alias: {
      // liquidjs-lib hashes via create-hash/create-hmac, whose browser builds need Node streams:
      // small @noble/hashes shims instead.
      'create-hash': here('./app/src/shims/create-hash.ts'),
      'create-hmac': here('./app/src/shims/create-hmac.ts'),
      buffer: here('./node_modules/buffer/index.js'),
    },
  },
  build: { outDir: '../dist/app', emptyOutDir: true, chunkSizeWarningLimit: 4096 },
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
});
