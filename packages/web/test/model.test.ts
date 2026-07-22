import { describe, expect, it } from 'vitest';
import {
  createInitialTripSetupState,
  duplicateStop,
  insertStop,
  moveStop,
  removeStop,
  restoreDraft,
  serializeDraft,
  updateStop,
  validateTripSetup,
} from '../src/model.js';
import { createSimulationPayload, RecalculationController } from '../src/api-client.js';

describe('mobile trip setup model', () => {
  it('keeps drive, shift, and cycle clocks independent', () => {
    const state = {
      ...createInitialTripSetupState(),
      clocks: { driveMinutesRemaining: 570, shiftMinutesRemaining: 405, cycleMinutesRemaining: 1320 },
    };
    expect(state.clocks).toEqual({ driveMinutesRemaining: 570, shiftMinutesRemaining: 405, cycleMinutesRemaining: 1320 });
  });

  it('supports insertion, duplication, accessible movement, and removal', () => {
    let state = createInitialTripSetupState();
    state = insertStop(state, 2, 'fuel');
    const fuel = state.stops[2];
    expect(fuel?.type).toBe('fuel');
    expect(state.stops.map((stop) => stop.sequence)).toEqual([0, 1, 2, 3]);

    if (fuel === undefined) throw new Error('Fuel stop was not inserted.');
    state = duplicateStop(state, fuel.localId);
    expect(state.stops).toHaveLength(5);
    const copy = state.stops[3];
    if (copy === undefined) throw new Error('Fuel stop was not duplicated.');
    state = moveStop(state, copy.localId, -1);
    expect(state.stops[2]?.localId).toBe(copy.localId);
    state = removeStop(state, copy.localId);
    expect(state.stops).toHaveLength(4);
  });

  it('preserves locked stop positions', () => {
    const state = createInitialTripSetupState();
    const start = state.stops[0];
    if (start === undefined) throw new Error('Start stop missing.');
    expect(moveStop(state, start.localId, 1)).toBe(state);
    expect(removeStop(state, start.localId)).toBe(state);
  });

  it('requires explicit duty status and legal-critical setup facts', () => {
    const issues = validateTripSetup(createInitialTripSetupState());
    expect(issues.map((issue) => issue.path)).toContain('currentDutyStatus');
    expect(issues.map((issue) => issue.path)).toContain('driver');
    expect(issues.some((issue) => issue.path.endsWith('.address'))).toBe(true);
  });

  it('keeps appointment and service settings independent per stop', () => {
    const initial = createInitialTripSetupState();
    const shipper = initial.stops[1];
    if (shipper === undefined) throw new Error('Shipper missing.');
    const state = updateStop(initial, shipper.localId, {
      appointment: { ...shipper.appointment, mode: 'fixed', fixedAt: '2026-07-23T09:00' },
      service: { ...shipper.service, mode: 'range', minimumMinutes: 30, maximumMinutes: 90 },
    });
    expect(state.stops[1]?.appointment.mode).toBe('fixed');
    expect(state.stops[1]?.service.mode).toBe('range');
  });

  it('round trips a locally preserved draft', () => {
    const state = createInitialTripSetupState();
    expect(restoreDraft(serializeDraft(state))).toEqual(state);
    expect(restoreDraft('{broken')).toBeUndefined();
  });

  it('serializes calculation input without performing legal arithmetic', () => {
    const state = createInitialTripSetupState();
    const payload = createSimulationPayload(state);
    expect(payload).toHaveProperty('clocks', state.clocks);
    expect(payload).not.toHaveProperty('legalDriveMinutes');
  });
});

describe('controlled recalculation', () => {
  it('debounces request storms', async () => {
    let calls = 0;
    const controller = new RecalculationController((): Promise<void> => {
      calls += 1;
      return Promise.resolve();
    }, 5);
    controller.request();
    controller.request();
    controller.request();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(calls).toBe(1);
  });
});
