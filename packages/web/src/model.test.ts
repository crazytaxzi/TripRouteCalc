// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  DRAFT_STORAGE_KEY,
  clearDraft,
  createStopForm,
  defaultTripDraft,
  draftReducer,
  hosFromDraft,
  loadDraft,
  saveDraft,
  stopPlan,
  validateDraft,
} from './model.js';

beforeEach(() => {
  localStorage.clear();
});

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

    const lockedStart = moved.stops[0];
    if (lockedStart === undefined) throw new Error('Missing locked start stop.');
    const attemptedLockedMove = draftReducer(moved, {
      type: 'move-stop',
      localId: lockedStart.localId,
      direction: 1,
    });
    expect(attemptedLockedMove).toBe(moved);
  });

  it('duplicates and inserts editable stops without reusing persisted identifiers', () => {
    let draft = defaultTripDraft();
    draft = draftReducer(draft, { type: 'add-stop', stopType: 'shipper' });
    const shipper = draft.stops[1];
    if (shipper === undefined) throw new Error('Missing shipper stop.');
    draft = draftReducer(draft, {
      type: 'stop',
      stop: {
        ...shipper,
        publicId: 'stp.persisted-example',
        locationDescription: 'Original shipper',
      },
    });

    const duplicated = draftReducer(draft, {
      type: 'duplicate-stop',
      localId: shipper.localId,
    });
    expect(duplicated.stops).toHaveLength(4);
    expect(duplicated.stops[2]?.locationDescription).toBe('Original shipper');
    expect(duplicated.stops[2]?.localId).not.toBe(shipper.localId);
    expect(duplicated.stops[2]?.publicId).toBeUndefined();
    expect(duplicated.stops[2]?.lockedPosition).toBe(false);

    const start = duplicated.stops[0];
    if (start === undefined) throw new Error('Missing start stop.');
    const inserted = draftReducer(duplicated, {
      type: 'insert-stop',
      afterLocalId: start.localId,
    });
    expect(inserted.stops).toHaveLength(5);
    expect(inserted.stops[1]?.type).toBe('other');
    expect(inserted.stops[0]?.type).toBe('start-location');
    expect(inserted.stops.at(-1)?.type).toBe('final-consignee');
  });

  it('stores a versioned non-secret draft and restores its trip reference', () => {
    const draft = {
      ...defaultTripDraft(),
      tripId: 'trp.public-trip-reference',
      driver: { displayName: 'Saved Driver' },
    };
    saveDraft(draft);

    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('bearer');
    expect(loadDraft()?.version).toBe(2);
    expect(loadDraft()?.tripId).toBe('trp.public-trip-reference');
    expect(loadDraft()?.driver.displayName).toBe('Saved Driver');

    clearDraft();
    expect(loadDraft()).toBeUndefined();
  });

  it('migrates an older v1 draft and fills newly required evidence fields', () => {
    const current = defaultTripDraft();
    const legacy = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    legacy.version = 1;
    delete legacy.draftId;
    const route = legacy.route as Record<string, unknown>;
    delete route.ruleSetVersion;
    delete route.autoCalculate;
    const hos = legacy.hos as Record<string, unknown>;
    delete hos.recapReturns;
    delete hos.existingSleeperPeriods;
    const stops = legacy.stops as Record<string, unknown>[];
    for (const stop of stops) {
      delete stop.serviceMode;
      delete stop.serviceMinimumMinutes;
      delete stop.serviceMaximumMinutes;
      delete stop.historicalSourceName;
      delete stop.historicalSampleSize;
    }
    localStorage.setItem(
      'trip-route-calc.stage18.draft.v1',
      JSON.stringify(legacy),
    );

    const migrated = loadDraft();
    expect(migrated?.version).toBe(2);
    expect(migrated?.draftId).toMatch(/^draft-/u);
    expect(migrated?.route.ruleSetVersion).toBe('');
    expect(migrated?.route.autoCalculate).toBe(false);
    expect(migrated?.hos.recapReturns).toEqual([]);
    expect(migrated?.hos.existingSleeperPeriods).toEqual([]);
    expect(migrated?.stops[0]?.serviceMode).toBe('expected');
    expect(migrated?.stops[0]?.lockedPosition).toBe(true);
    expect(migrated?.stops.at(-1)?.type).toBe('final-consignee');
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem('trip-route-calc.stage18.draft.v1')).toBeNull();
  });

  it('maps complete appointment and service modes into the stop domain contract', () => {
    const base = createStopForm('shipper');
    const ranged = stopPlan(
      {
        ...base,
        locationDescription: 'Ranged shipper',
        appointmentMode: 'open-window',
        appointmentStartLocal: '2026-07-22T08:00',
        appointmentEndLocal: '2026-07-22T12:00',
        lateToleranceMinutes: 15,
        serviceMode: 'range',
        serviceMinimumMinutes: 30,
        serviceMinutes: 45,
        serviceMaximumMinutes: 90,
      },
      1,
    );
    expect(ranged.appointment.mode).toBe('open-window');
    expect(ranged.serviceDuration).toMatchObject({
      mode: 'range',
      minimum: { value: 30, unit: 'minute' },
      expected: { value: 45, unit: 'minute' },
      maximum: { value: 90, unit: 'minute' },
    });

    const historical = stopPlan(
      {
        ...base,
        locationDescription: 'Known facility',
        serviceMode: 'historical-average',
        serviceMinutes: 72,
        historicalSourceName: 'Carrier facility history',
        historicalSampleSize: 14,
      },
      2,
    );
    expect(historical.serviceDuration).toMatchObject({
      mode: 'historical-average',
      duration: { value: 72, unit: 'minute' },
      sourceName: 'Carrier facility history',
      sampleSize: 14,
    });
  });

  it('maps recap returns and sleeper periods into validated departure evidence', () => {
    const base = defaultTripDraft();
    const draft = {
      ...base,
      driver: { displayName: 'Evidence Driver' },
      hos: {
        ...base.hos,
        departureLocal: '2026-07-22T12:00',
        departureTimeZone: 'America/Denver',
        currentDutyStatusStartedLocal: '2026-07-22T11:30',
        recapReturns: [
          {
            localId: 'recap-form-1',
            sourceDate: '2026-07-14',
            availableLocal: '2026-07-22T13:00',
            returnedMinutes: 480,
          },
        ],
        existingSleeperPeriods: [
          {
            id: 'sleeper-form-1',
            startLocal: '2026-07-22T04:00',
            endLocal: '2026-07-22T11:00',
            durationMinutes: 420,
            candidateRole: 'LONG_PERIOD' as const,
            pairId: 'split-pair-1',
            source: 'USER_ENTERED' as const,
            explanation: 'Driver entered a completed seven-hour sleeper period.',
          },
        ],
        splitSleeperEnabled: true,
      },
    };

    const state = hosFromDraft(draft);
    expect(state.recapReturns).toEqual([
      {
        sourceDate: '2026-07-14',
        availableAt: '2026-07-22T19:00:00Z',
        returnedTime: { value: 480, unit: 'minute' },
      },
    ]);
    expect(state.existingSleeperPeriods).toEqual([
      {
        id: 'sleeper-form-1',
        startAt: '2026-07-22T10:00:00Z',
        endAt: '2026-07-22T17:00:00Z',
        duration: { value: 420, unit: 'minute' },
        candidateRole: 'LONG_PERIOD',
        pairId: 'split-pair-1',
        source: 'USER_ENTERED',
        explanation: 'Driver entered a completed seven-hour sleeper period.',
      },
    ]);
  });

  it('reports missing route-critical evidence before submission', () => {
    const issues = validateDraft(defaultTripDraft());
    expect(issues.some((issue) => issue.path === 'driver.displayName')).toBe(true);
    expect(issues.some((issue) => issue.path === 'route.ruleSetVersion')).toBe(true);
    expect(
      issues.some((issue) => issue.path.endsWith('.coordinates')),
    ).toBe(true);
  });
});
