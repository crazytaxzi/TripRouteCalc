import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function source(name: string): string {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

describe('Stage 18 detailed evidence wiring', () => {
  it('mounts detailed recovery, validation, and equipment editing in the App', () => {
    const app = source('./App.tsx');

    expect(app).toContain("from './trip-form-model.js'");
    expect(app).toContain("import { EquipmentDetailEditor } from './equipment-detail-editor.js';");
    expect(app).toContain('<EquipmentDetailEditor');
    expect(app).not.toContain('name="permit-identifiers"');
  });

  it('uses detailed equipment payloads and clears stale public stop references', () => {
    const client = source('./api-client.ts');

    expect(client).toContain("from './equipment-detail-model.js'");
    expect(client).toContain('detailedRouteRequestFromDraft as routeRequestFromDraft');
    expect(client).toContain('const serverIds = new Set');
    expect(client).toContain('!serverIds.has(stop.publicId)');
  });
});
