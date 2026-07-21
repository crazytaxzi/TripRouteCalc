import { describe, expect, it } from 'vitest';

import { evaluateRegulatoryCompliance } from '../src/index.js';
import { equipment, input, kpraRule, segment } from './regulatory-fixtures.js';

describe('provider and manual-verification gaps', () => {
  it('blocks an unverified provider segment and local access gap', () => {
    const local = segment('ca-1', 'US-CA', 'LOCAL-ROAD');
    const result = evaluateRegulatoryCompliance(
      input([], {
        providerVerificationStatus: 'partially-verified',
        segments: [
          {
            ...local,
            localAccessSegment: true,
            localAccessVerified: false,
            segment: { ...local.segment, verificationStatus: 'unverified' },
          },
        ],
      }),
    );

    expect(result.status).toBe('manual-verification-required');
    expect(result.manualVerificationSegmentIds).toEqual(['ca-1']);
    expect(result.findings.map((finding) => finding.findingId)).toEqual(
      expect.arrayContaining([
        'provider:SEGMENT_PROVIDER_GAP:ca-1',
        'provider:LOCAL_ACCESS_UNVERIFIED:ca-1',
      ]),
    );
  });

  it('requires manual verification when exact road identity is unavailable', () => {
    const result = evaluateRegulatoryCompliance(
      input([kpraRule('ROAD-SCOPED', 38, 'CA-99')], {
        equipment: equipment(39),
        segments: [segment('ca-1', 'US-CA')],
      }),
    );

    expect(result.status).toBe('manual-verification-required');
    expect(result.findings[0]).toMatchObject({
      ruleId: 'ROAD-SCOPED',
      severity: 'manual-verification-required',
      affectedSegmentId: 'ca-1',
    });
  });
});
