import { describe, expect, it } from 'vitest';

import { HosValidationError } from '@trip-route-calc/foundation';

import type { PlanTripBody } from '../src/contracts.js';
import { assembleStage18DriverHosDepartureState } from '../src/stage18-hos.js';

function planningBody(): PlanTripBody {
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
      provenance: 'imported_eld',
      drivenSinceQualifyingInterruptionMinutes: 0,
      onDutyCurrentShiftMinutes: 30,
      offDutyBeforeDepartureMinutes: 600,
      qualifyingTenHourBreakCompleted: true,
      priorDutyTotals: Array.from({ length: 8 }, (_value, index) => ({
        date: `2026-07-${String(index + 15).padStart(2, '0')}`,
        onDutyMinutes: 480,
      })),
      cycleRecaps: [
        {
          availableAt: '2026-07-24T00:00:00-06:00',
          minutesReturning: 480,
        },
      ],
      sleeperBerthEligible: true,
      existingSleeperPeriods: [
        {
          startAt: '2026-07-21T20:00:00-06:00',
          endAt: '2026-07-21T22:30:00-06:00',
        },
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
        endLocalTime: '07:00',
      },
    },
  };
}

describe('Stage 18 server HOS assembly', () => {
  it('assembles and validates the accepted departure-state model', () => {
    const result = assembleStage18DriverHosDepartureState(planningBody(), {
      publicId: 'drv.public-stage18-driver',
      nameOrIdentifier: 'Driver One',
    });

    expect(result.driver).toEqual({
      id: 'drv.public-stage18-driver',
      nameOrIdentifier: 'Driver One',
    });
    expect(result.cycleType).toBe('SEVENTY_HOURS_EIGHT_DAYS');
    expect(result.currentDutyStatus).toBe('ON_DUTY_NOT_DRIVING');
    expect(result.drivingTimeRemaining.value).toBe(600);
    expect(result.priorDutyDays).toHaveLength(8);
    expect(result.nightlyRestPreference).toMatchObject({
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timeZone: 'America/Boise',
    });
  });

  it('derives recap source dates from local availability and cycle length', () => {
    const result = assembleStage18DriverHosDepartureState(planningBody(), {
      nameOrIdentifier: 'Driver One',
    });

    expect(result.recapReturns).toEqual([
      {
        sourceDate: '2026-07-16',
        availableAt: '2026-07-24T06:00:00.000Z',
        returnedTime: { value: 480, unit: 'minute' },
      },
    ]);
  });

  it('derives short and long sleeper candidate roles from exact duration', () => {
    const result = assembleStage18DriverHosDepartureState(planningBody(), {
      nameOrIdentifier: 'Driver One',
    });

    expect(
      result.existingSleeperPeriods.map((period) => period.candidateRole),
    ).toEqual(['SHORT_PERIOD', 'LONG_PERIOD']);
    expect(
      result.existingSleeperPeriods.map((period) => period.duration.value),
    ).toEqual([150, 420]);
    expect(result.existingSleeperPeriods[0]?.source).toBe('ELD_PROVIDER');
  });

  it('preserves source classification without claiming verification', () => {
    const body = planningBody();
    const result = assembleStage18DriverHosDepartureState(
      {
        ...body,
        hos: { ...body.hos, provenance: 'carrier_record' },
      },
      { nameOrIdentifier: 'Driver One' },
    );

    expect(result.provenance.dutyHistory).toMatchObject({
      origin: 'PROVIDER_DERIVED',
      verification: 'UNVERIFIED',
      sourceName: 'Carrier record facts',
    });
    expect(result.existingSleeperPeriods[0]?.source).toBe('CARRIER_SYSTEM');
  });

  it('rejects sleeper evidence shorter than the accepted minimum', () => {
    const body = planningBody();

    expect(() =>
      assembleStage18DriverHosDepartureState(
        {
          ...body,
          hos: {
            ...body.hos,
            existingSleeperPeriods: [
              {
                startAt: '2026-07-22T00:00:00-06:00',
                endAt: '2026-07-22T01:00:00-06:00',
              },
            ],
            splitSleeperEnabled: false,
          },
        },
        { nameOrIdentifier: 'Driver One' },
      ),
    ).toThrow(HosValidationError);
  });

  it('rejects contradictory entered break and clock facts', () => {
    const body = planningBody();

    expect(() =>
      assembleStage18DriverHosDepartureState(
        {
          ...body,
          hos: {
            ...body.hos,
            offDutyBeforeDepartureMinutes: 300,
            qualifyingTenHourBreakCompleted: true,
          },
        },
        { nameOrIdentifier: 'Driver One' },
      ),
    ).toThrow(/requires at least 600/u);
  });
});
