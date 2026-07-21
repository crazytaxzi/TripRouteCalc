// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  DRAFT_STORAGE_KEY,
  clearDraft,
  defaultTripDraft,
  draftReducer,
  loadDraft,
  saveDraft,
  validateDraft,
} from './model.js';

describe('Stage 18 trip draft model', () => {
  it('preserves locked endpoint stops while moving intermediate stops', () => {
    let draft = defaultTripDraft();
    draft = draftReducer(draft, { type: 'add-stop', stopType: 'shipper' });
    draft = draftReducer(draft, {
      type: 'add-stop',
      stopType: 'intermediate-delivery',
    });
    const firstIntermediate = draft.stops[1];
    expect(firstIntermediate).toBeDefined();
    if (firstIntermediate === undefined) throw new Error('Missing intermediate stop.');

    const moved = draftReducer(draft, {
      type: 'move-stop',
      localId: firstIntermediate.localId,
      direction: 1,
    });

    expect(moved.stops[0]?.type).toBe('start-location');
    expect(moved.stops.at(-1)?.type).toBe('final-consignee');
    expect(moved.stops[2]?.localId).toBe(firstIntermediate.localId);

    const attemptedLockedMove = draftReducer(moved, {
      type: 'move-stop',
      localId: moved.stops[0]!.localId,
      direction: 1,
    });
    expect(attemptedLockedMove).toBe(moved);
  });

  it('stores a versioned non-secret draft and restores it', () => {
    const draft = {
      ...defaultTripDraft(),
      driver: { displayName: 'Saved Driver' },
    };
    saveDraft(draft);

    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('bearer');
    expect(loadDraft()?.driver.displayName).toBe('Saved Driver');

    clearDraft();
    expect(loadDraft()).toBeUndefined();
  });

  it('reports missing route-critical stop evidence before submission', () => {
    const issues = validateDraft(defaultTripDraft());
    expect(issues.some((issue) => issue.path === 'driver.displayName')).toBe(true);
    expect(
      issues.some((issue) => issue.path.endsWith('.coordinates')),
    ).toBe(true);
  });
});
