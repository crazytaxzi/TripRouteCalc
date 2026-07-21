import { describe, expect, it } from 'vitest';

import { evaluateRegulatoryCompliance } from '../src/index.js';
import { equipment, input, kpraRule } from './regulatory-fixtures.js';

describe('segment-scoped regulatory evaluation', () => {
  it('applies a KPRA action only to the affected jurisdiction segment', () => {
    const result = evaluateRegulatoryCompliance(
      input([kpraRule('CA-KPRA-40', 40)], { equipment: equipment(42.5) }),
    );

    expect(result.status).toBe('action-required');
    expect(result.legalFinalizationStatus).toBe('blocked');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: 'CA-KPRA-40',
      affectedSegmentId: 'ca-1',
      jurisdictionCode: 'US-CA',
    });
    expect(result.findings.some((finding) => finding.affectedSegmentId === 'or-1')).toBe(false);
  });

  it('allows finalization when every applicable rule is satisfied', () => {
    const result = evaluateRegulatoryCompliance(input([kpraRule('CA-KPRA-40', 40)]));
    expect(result.status).toBe('compliant');
    expect(result.legalFinalizationStatus).toBe('allowed');
    expect(result.findings).toEqual([]);
  });
});
