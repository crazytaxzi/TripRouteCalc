import { utcInstant, validateJurisdictionRule } from '@trip-route-calc/foundation';
import { describe, expect, it } from 'vitest';

import { evaluateRegulatoryCompliance } from '../src/index.js';
import { equipment, input, kpraRule, segment } from './regulatory-fixtures.js';

describe('rule version and road scope', () => {
  it('applies a road-specific restriction only to the named road', () => {
    const ca99 = segment('ca-99', 'US-CA', 'CA-99');
    const result = evaluateRegulatoryCompliance(
      input([kpraRule('CA-99-KPRA-38', 38, 'CA-99')], {
        equipment: equipment(39),
        segments: [
          segment('or-1', 'US-OR', 'I-5'),
          segment('ca-1', 'US-CA', 'I-5'),
          { ...ca99, segment: { ...ca99.segment, sequence: 3 } },
        ],
      }),
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.affectedSegmentId).toBe('ca-99');
  });

  it('ignores a rule that expired before the evaluation timestamp', () => {
    const expired = validateJurisdictionRule({
      ...kpraRule('EXPIRED-KPRA', 1),
      effectiveFrom: utcInstant('2025-01-01T00:00:00Z'),
      effectiveTo: utcInstant('2025-12-31T00:00:00Z'),
    });
    const result = evaluateRegulatoryCompliance(
      input([expired], { equipment: equipment(45) }),
    );

    expect(result.findings).toEqual([]);
    expect(result.legalFinalizationStatus).toBe('allowed');
  });
});
