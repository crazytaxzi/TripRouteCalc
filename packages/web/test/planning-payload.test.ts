import { describe, expect, it } from 'vitest';

import {
  PlanningPayloadError,
  createPlanPayload,
  localDateTimeWithOffset,
} from '../src/planning-payload.js';
import { createInitialTripSetupState } from '../src/model.js';

function completeState() {
  const initial = createInitialTripSetupState();
  return {
    ...initial,
    tripId: 'trip-public-id',
    revisionNumber: 9,
    driver: { selectedId: 'driver-public-id', displayName: 'Driver One' },
    tractor: { selectedId: 'tractor-public-id', displayName: 'Tractor One' },
    trailer: { selectedId: 'trailer-public-id', displayName: 'Trailer One' },
    load: { selectedId: 'load-public-id', displayName: 'Load One' },
    departureAt: '2026-07-23T08:00',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'on_duty_not_driving' as const,
    currentDutyStatusBeganAt: '2026-07-23T07:30',
    clocks: {
      driveMinutesRemaining: 600,
      shiftMinutesRemaining: 780,
      cycleMinutesRemaining: 3_600,
    },
    hos: {
      ...initial.hos,
      cycleType: '70_in_8' as const,
      provenance: 'user_entered' as const,
      qualifyingTenHourBreakCompleted: true,
      offDutyBeforeDepartureMinutes: 600,
      priorDutyTotals: Array.from({ length: 8 }, (_value, index) => ({
        date: `2026-07-${String(index + 15).padStart(2, '0')}`,
        onDutyMinutes: 480,
      })),
      cycleRecaps: [
        { availableAt: '2026-07-24T00:00', minutesReturning: 480 },
      ],
      sleeperBerthEligible: true,
      existingSleeperPeriods: [
        { startAt: '2026-07-22T00:00', endAt: '2026-07-22T07:00' },
      ],
    },
    stops: initial.stops.map((stop, index) => ({
      ...stop,
      serverId: `stop-${String(index + 1)}`,
      address: `Stop ${String(index + 1)}`,
    })),
  };
}

describe('Stage 18 planning payload', () => {
  it('resolves ordinary local times with the applicable IANA offset', () => {
    expect(
      localDateTimeWithOffset(
        '2026-07-23T08:00',
        'America/Boise',
        'departureAt',
      ),
    ).toBe('2026-07-23T08:00:00-06:00');
  });

  it('rejects nonexistent daylight-saving local times', () => {
    expect(() =>
      localDateTimeWithOffset(
        '2026-03-08T02:30',
        'America/Denver',
        'departureAt',
      ),
    ).toThrow(PlanningPayloadError);
  });

  it('rejects ambiguous daylight-saving local times without an explicit offset', () => {
    expect(() =>
      localDateTimeWithOffset(
        '2026-11-01T01:30',
        'America/Denver',
        'departureAt',
      ),
    ).toThrow(/occurs twice/u);
  });

  it('preserves a valid caller-entered explicit offset', () => {
    expect(
      localDateTimeWithOffset(
        '2026-11-01T01:30:00-07:00',
        'America/Denver',
        'departureAt',
      ),
    ).toBe('2026-11-01T01:30:00-07:00');
  });

  it('serializes entered facts without legal-engine objects', () => {
    const payload = createPlanPayload(completeState());

    expect(payload).toMatchObject({
      expectedRevisionNumber: 9,
      departureAt: '2026-07-23T08:00:00-06:00',
      currentDutyStatusBeganAt: '2026-07-23T07:30:00-06:00',
      hos: {
        cycleType: '70_in_8',
        provenance: 'user_entered',
        priorDutyTotals: expect.any(Array),
        cycleRecaps: [
          {
            availableAt: '2026-07-24T00:00:00-06:00',
            minutesReturning: 480,
          },
        ],
      },
    });
    expect(payload).not.toHaveProperty('route');
    expect(payload).not.toHaveProperty('simulation');
    expect(payload).not.toHaveProperty('complianceActions');
    expect(payload).not.toHaveProperty('operationalEvents');
  });
});
