import { describe, expect, it } from 'vitest';

import { PlanTripBodySchema } from '../src/contracts.js';

function validPlanningBody(): Record<string, unknown> {
  return {
    expectedRevisionNumber: 12,
    departureAt: '2026-07-23T08:00:00-06:00',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'on_duty_not_driving',
    currentDutyStatusBeganAt: '2026-07-23T07:30:00-06:00',
    clocks: {
      driveMinutesRemaining: 600,
      shiftMinutesRemaining: 780,
      cycleMinutesRemaining: 3_600,
    },
    hos: {
      cycleType: '70_in_8',
      provenance: 'user_entered',
      drivenSinceQualifyingInterruptionMinutes: 0,
      onDutyCurrentShiftMinutes: 30,
      offDutyBeforeDepartureMinutes: 600,
      qualifyingTenHourBreakCompleted: true,
      priorDutyTotals: [
        { date: '2026-07-22', onDutyMinutes: 480 },
      ],
      cycleRecaps: [],
      sleeperBerthEligible: true,
      existingSleeperPeriods: [],
      splitSleeperEnabled: false,
      plannedThirtyFourHourRestart: false,
      carrierMaximumDrivingMinutes: 660,
      carrierMaximumDutyMinutes: 840,
      restPreference: {
        enabled: false,
        startLocalTime: '',
        endLocalTime: '',
      },
    },
  };
}

describe('Stage 18 planning request contract', () => {
  it('accepts entered trip and HOS facts without legal-engine objects', () => {
    const parsed = PlanTripBodySchema.parse(validPlanningBody());
    expect(parsed.clocks.driveMinutesRemaining).toBe(600);
    expect(parsed.hos.cycleType).toBe('70_in_8');
  });

  it.each(['route', 'simulation', 'operationalEvents', 'complianceActions'])(
    'rejects browser-authored %s data',
    (field) => {
      expect(() =>
        PlanTripBodySchema.parse({ ...validPlanningBody(), [field]: {} }),
      ).toThrow();
    },
  );

  it('rejects contradictory split-sleeper eligibility', () => {
    const body = validPlanningBody();
    const hos = body.hos as Record<string, unknown>;
    expect(() =>
      PlanTripBodySchema.parse({
        ...body,
        hos: {
          ...hos,
          sleeperBerthEligible: false,
          splitSleeperEnabled: true,
        },
      }),
    ).toThrow();
  });

  it('rejects a carrier driving target above its duty target', () => {
    const body = validPlanningBody();
    const hos = body.hos as Record<string, unknown>;
    expect(() =>
      PlanTripBodySchema.parse({
        ...body,
        hos: {
          ...hos,
          carrierMaximumDrivingMinutes: 900,
          carrierMaximumDutyMinutes: 840,
        },
      }),
    ).toThrow();
  });

  it('requires offset-aware instants at the API boundary', () => {
    expect(() =>
      PlanTripBodySchema.parse({
        ...validPlanningBody(),
        departureAt: '2026-07-23T08:00',
      }),
    ).toThrow();
  });
});
