import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@trip-route-calc/foundation': fileURLToPath(
        new URL('../foundation/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/openapi.json': 'http://127.0.0.1:3000',
      '/openapi-stage18.json': 'http://127.0.0.1:3000',
    },
  },
  preview: { port: 4173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: true,
  },
});
