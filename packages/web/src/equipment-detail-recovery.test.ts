// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { loadDetailedDraft } from './equipment-detail-model.js';
import { DRAFT_STORAGE_KEY } from './model.js';

beforeEach(() => {
  localStorage.clear();
});

describe('Stage 18 detailed draft recovery', () => {
  it('cleans malformed JSON without throwing', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, '{not-json');

    expect(() => loadDetailedDraft()).not.toThrow();
    expect(loadDetailedDraft()).toBeUndefined();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });
});
