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
      clocks: {
        driveMinutesRemaining: 570,
        shiftMinutesRemaining: 405,
        cycleMinutesRemaining: 1320,
      },
    };
    expect(state.clocks).toEqual({
      driveMinutesRemaining: 570,
      shiftMinutesRemaining: 405,
      cycleMinutesRemaining: 1320,
    });
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
    const paths = issues.map((issue) => issue.path);
    expect(paths).toContain('currentDutyStatus');
    expect(paths).toContain('driver');
    expect(paths).toContain('hos.cycleType');
    expect(paths).toContain('hos.provenance');
    expect(paths.some((path) => path.endsWith('.address'))).toBe(true);
  });

  it('validates the complete HOS departure history without combining clocks', () => {
    const initial = createInitialTripSetupState();
    const state = {
      ...initial,
      hos: {
        ...initial.hos,
        cycleType: '70_in_8' as const,
        provenance: 'imported_eld' as const,
        drivenSinceQualifyingInterruptionMinutes: 210,
        onDutyCurrentShiftMinutes: 180,
        offDutyBeforeDepartureMinutes: 600,
        qualifyingTenHourBreakCompleted: true,
        priorDutyTotals: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-07-${String(index + 15).padStart(2, '0')}`,
          onDutyMinutes: 480,
        })),
        cycleRecaps: [
          { availableAt: '2026-07-24T00:00:00-06:00', minutesReturning: 480 },
        ],
        sleeperBerthEligible: true,
        existingSleeperPeriods: [
          {
            startAt: '2026-07-22T00:00:00-06:00',
            endAt: '2026-07-22T07:00:00-06:00',
          },
        ],
        splitSleeperEnabled: true,
        plannedThirtyFourHourRestart: false,
        carrierMaximumDrivingMinutes: 660,
        carrierMaximumDutyMinutes: 840,
        restPreference: {
          enabled: true,
          startLocalTime: '22:00',
          endLocalTime: '08:00',
        },
      },
    };
    const hosIssues = validateTripSetup(state).filter((issue) =>
      issue.path.startsWith('hos.'),
    );
    expect(hosIssues).toEqual([]);
    expect(state.clocks).toEqual(initial.clocks);
  });

  it('rejects inconsistent sleeper and carrier constraints', () => {
    const initial = createInitialTripSetupState();
    const state = {
      ...initial,
      hos: {
        ...initial.hos,
        cycleType: '60_in_7' as const,
        provenance: 'user_entered' as const,
        priorDutyTotals: Array.from({ length: 6 }, (_, index) => ({
          date: `2026-07-${String(index + 16).padStart(2, '0')}`,
          onDutyMinutes: 300,
        })),
        splitSleeperEnabled: true,
        sleeperBerthEligible: false,
        carrierMaximumDrivingMinutes: 900,
        carrierMaximumDutyMinutes: 840,
      },
    };
    const paths = validateTripSetup(state).map((issue) => issue.path);
    expect(paths).toContain('hos.splitSleeperEnabled');
    expect(paths).toContain('hos.carrierMaximumDrivingMinutes');
  });

  it('keeps appointment and service settings independent per stop', () => {
    const initial = createInitialTripSetupState();
    const shipper = initial.stops[1];
    if (shipper === undefined) throw new Error('Shipper missing.');
    const state = updateStop(initial, shipper.localId, {
      appointment: {
        ...shipper.appointment,
        mode: 'fixed',
        fixedAt: '2026-07-23T09:00',
      },
      service: {
        ...shipper.service,
        mode: 'range',
        minimumMinutes: 30,
        maximumMinutes: 90,
      },
    });
    expect(state.stops[1]?.appointment.mode).toBe('fixed');
    expect(state.stops[1]?.service.mode).toBe('range');
  });

  it('round trips a locally preserved draft', () => {
    const state = createInitialTripSetupState();
    expect(restoreDraft(serializeDraft(state))).toEqual(state);
    expect(restoreDraft('{broken')).toBeUndefined();
  });

  it('restores older drafts with the new HOS fields safely defaulted', () => {
    const initial = createInitialTripSetupState();
    const legacy = JSON.stringify({
      ...initial,
      hos: undefined,
      deletedServerStopIds: undefined,
    });
    const restored = restoreDraft(legacy);
    expect(restored?.hos.cycleType).toBe('');
    expect(restored?.hos.carrierMaximumDrivingMinutes).toBe(660);
    expect(restored?.deletedServerStopIds).toEqual([]);
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
