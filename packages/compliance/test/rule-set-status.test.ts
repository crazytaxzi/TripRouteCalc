import { describe, expect, it } from 'vitest';

import { evaluateRegulatoryCompliance } from '../src/index.js';
import { equipment, input, kpraRule, ruleSet } from './regulatory-fixtures.js';

describe('rule-set status and replay', () => {
  it('blocks an inactive rule set instead of treating it as current law', () => {
    const result = evaluateRegulatoryCompliance(
      input([], { ruleSet: ruleSet([], 'draft') }),
    );

    expect(result.status).toBe('blocked');
    expect(result.legalFinalizationStatus).toBe('blocked');
    expect(result.explanations.join(' ')).toMatch(/not active/iu);
  });

  it('produces deterministic findings from identical route-revision facts', () => {
    const value = input([kpraRule('CA-KPRA-40', 40)], {
      equipment: equipment(42),
    });

    expect(evaluateRegulatoryCompliance(value)).toEqual(
      evaluateRegulatoryCompliance(value),
    );
  });
});
