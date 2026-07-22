import { describe, expect, it } from 'vitest';

import { buildStage18HosDepartureState } from '../src/stage18-trip-setup.js';
import { utcInstant } from '../src/time.js';
import { durationInMinutes } from '../src/units.js';

describe('Stage 18 trip setup builders', () => {
  it('preserves expected recap returns and existing sleeper evidence', () => {
    const recap = {
      sourceDate: '2026-07-14',
      availableAt: utcInstant('2026-07-23T00:00:00.000Z'),
      returnedTime: durationInMinutes(480),
    };
    const sleeper = {
      id: 'sleeper-period-stage-18',
      startAt: utcInstant('2026-07-22T06:00:00.000Z'),
      endAt: utcInstant('2026-07-22T13:00:00.000Z'),
      duration: durationInMinutes(420),
      candidateRole: 'LONG_PERIOD' as const,
      source: 'USER_ENTERED' as const,
      explanation: 'User-entered sleeper period for Stage 18 planning.',
    };

    const state = buildStage18HosDepartureState({
      driverNameOrIdentifier: 'Stage 18 Driver',
      departureAt: '2026-07-22T18:00:00.000Z',
      departureTimeZone: 'America/Denver',
      currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
      currentDutyStatusStartedAt: '2026-07-22T17:30:00.000Z',
      drivingMinutesRemaining: 660,
      shiftMinutesRemaining: 840,
      cycleMinutesRemaining: 4_200,
      cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
      drivenMinutesSinceLastQualifyingInterruption: 0,
      onDutyMinutesCurrentShift: 30,
      offDutyMinutesImmediatelyBeforeDeparture: 600,
      qualifyingTenHourBreakCompleted: true,
      priorDutyMinutes: Array.from({ length: 8 }, () => 0),
      recapReturns: [recap],
      sleeperBerthEligible: true,
      existingSleeperPeriods: [sleeper],
      splitSleeperEnabled: true,
      restart34HourPlanned: false,
      carrierMaxDailyDrivingMinutes: 660,
      carrierMaxDutyMinutes: 840,
    });

    expect(state.recapReturns).toEqual([recap]);
    expect(state.existingSleeperPeriods).toEqual([sleeper]);
    expect(Object.isFrozen(state.recapReturns)).toBe(true);
    expect(Object.isFrozen(state.existingSleeperPeriods)).toBe(true);
  });
});
