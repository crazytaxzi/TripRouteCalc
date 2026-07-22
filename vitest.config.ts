import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@trip-route-calc/foundation/regulatory': fileURLToPath(
        new URL('./packages/foundation/src/regulatory.ts', import.meta.url),
      ),
      '@trip-route-calc/foundation': fileURLToPath(
        new URL('./packages/foundation/src/index.ts', import.meta.url),
      ),
      '@trip-route-calc/persistence': fileURLToPath(
        new URL('./packages/persistence/src/index.ts', import.meta.url),
      ),
      '@trip-route-calc/routing': fileURLToPath(
        new URL('./packages/routing/src/index.ts', import.meta.url),
      ),
      '@trip-route-calc/compliance': fileURLToPath(
        new URL('./packages/compliance/src/index.ts', import.meta.url),
      ),
      '@trip-route-calc/api': fileURLToPath(
        new URL('./packages/api/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/web/src/**/*.test.ts',
      'packages/web/src/**/*.test.tsx',
    ],
    setupFiles: ['./packages/web/src/test-setup.ts'],
    passWithNoTests: false,
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
