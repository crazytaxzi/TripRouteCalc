import { describe, expect, it } from 'vitest';

import { stage17OpenApiDocument } from '../src/index.js';

describe('Stage 17 OpenAPI contract', () => {
  it('publishes every required endpoint and structured blocking response', () => {
    const document = stage17OpenApiDocument();
    const paths = document.paths as Readonly<Record<string, unknown>>;

    expect(Object.keys(paths).sort()).toEqual(
      [
        '/api/drivers',
        '/api/equipment/loads',
        '/api/equipment/tractors',
        '/api/equipment/trailers',
        '/api/regulations/version',
        '/api/routes/validate',
        '/api/trips',
        '/api/trips/{tripId}',
        '/api/trips/{tripId}/calculate',
        '/api/trips/{tripId}/compliance',
        '/api/trips/{tripId}/revisions',
        '/api/trips/{tripId}/stops',
        '/api/trips/{tripId}/stops/reorder',
        '/api/trips/{tripId}/stops/{stopId}',
        '/api/trips/{tripId}/timeline',
        '/openapi.json',
      ].sort(),
    );

    const calculate = paths['/api/trips/{tripId}/calculate'] as {
      readonly post: {
        readonly responses: Readonly<Record<string, unknown>>;
      };
    };
    expect(calculate.post.responses).toHaveProperty('422');
  });

  it('contains no credential values or fake legal-success examples', () => {
    const serialized = JSON.stringify(stage17OpenApiDocument());

    expect(serialized).not.toMatch(/api[-_ ]?key\s*[=:]/iu);
    expect(serialized).not.toMatch(/bearer\s+[a-z0-9._-]+/iu);
    expect(serialized).not.toContain('route is legal');
    expect(serialized).toContain('LEGAL_BLOCKING_FINDING');
  });
});
