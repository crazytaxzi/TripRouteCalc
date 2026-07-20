import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const engineFiles = [
  'hos-core.ts',
  'hos-cycle.ts',
  'hos-advanced.ts',
] as const;

function readPackageFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Stage 08 pure HOS engine isolation', () => {
  it('keeps production foundation dependencies limited to pure calculation libraries', () => {
    const packageJson = JSON.parse(
      readPackageFile('../package.json'),
    ) as { readonly dependencies?: Readonly<Record<string, string>> };

    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual([
      '@js-temporal/polyfill',
      'zod',
    ]);
  });

  it.each(engineFiles)('keeps %s free of database, browser, route-provider, and network imports', (file) => {
    const source = readPackageFile(`../src/${file}`);
    const forbidden = [
      '@trip-route-calc/persistence',
      '@prisma/client',
      'react',
      'fastify',
      'playwright',
      'node:http',
      'node:https',
      'fetch(',
      'XMLHttpRequest',
      'localStorage',
      'sessionStorage',
    ];

    forbidden.forEach((value) => {
      expect(source.includes(value)).toBe(false);
    });
  });
});
