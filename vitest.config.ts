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
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    passWithNoTests: false,
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
