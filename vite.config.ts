import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// DAMP's browser modules (signer bridge, wallet sync, registry) come from its checkout, next to
// this one as in the Docker build context; DAMP_DIR overrides it. The signer's WebAssembly must
// be built there first (`make wasm` in damp/; the Dockerfile builds it itself).
const damp = process.env.DAMP_DIR ?? here('../damp');

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
      '@damp': `${damp}/apps/web/src/lib`,
    },
    // DAMP's modules import these too: one copy, from this app.
    dedupe: ['react', 'react-dom', '@tanstack/react-query', 'zod', 'idb'],
  },
  build: { outDir: '../dist/app', emptyOutDir: true, chunkSizeWarningLimit: 4096 },
  server: { proxy: { '/api': 'http://127.0.0.1:8080' }, fs: { allow: [here('.'), damp] } },
});
