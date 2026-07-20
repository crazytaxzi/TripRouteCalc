import { describe, expect, it } from 'vitest';

import {
  calculateHosAdvancedRules,
} from '../src/hos-advanced.js';
import type {
  HosAdverseDrivingConditionSelection,
} from '../src/hos-advanced.js';
import { calculateHosCore } from '../src/hos-core.js';
import { calculateHosCycle } from '../src/hos-cycle.js';
import {
  HosValidationError,
  validateDutyEvent,
  validateDutyEventHistory,
} from '../src/hos.js';
import { utcInstant } from '../src/time.js';
import { durationInMinutes } from '../src/units.js';
import {
  addMinutes,
  completeHistory,
  departureState,
  dutyEvent,
  utcRegulatoryBoundary,
} from './hos-test-fixtures.js';

function violationCodes(
  result: ReturnType<typeof calculateHosCore>,
): readonly string[] {
  return result.violations.map((violation) => violation.code);
}

function adverseSelection(minutes: number): HosAdverseDrivingConditionSelection {
  return {
    id: `adverse-${String(minutes)}`,
    encounteredAt: utcInstant('2026-07-20T00:00:00.000Z'),
    conditionType: 'SNOW',
    description: 'Unexpected snow developed after dispatch.',
    requestedExtension: durationInMinutes(minutes),
    purpose: 'REACH_SAFE_PLACE',
    normalRunWasLegallyCompletable: true,
    driverCouldNotReasonablyKnowBeforeDutyOrQualifyingRest: true,
    carrierCouldNotReasonablyKnowBeforeDispatch: true,
    conditionPreventedSafeCompletionWithinNormalLimits: true,
    source: 'Timestamped driver and dispatch evidence',
    confidence: 'SUPPORTED',
    explanation: 'The condition was not reasonably knowable before dispatch.',
  };
}

function evaluateAdvanced(
  departure: ReturnType<typeof departureState>,
  dutyEvents: readonly ReturnType<typeof dutyEvent>[],
  options: Readonly<{
    selectedSleeperPairId?: string;
    adverseDrivingCondition?: HosAdverseDrivingConditionSelection;
    unsupportedSpecialRuleSelections?: readonly {
      readonly rule: 'PERSONAL_CONVEYANCE' | 'FLEXIBLE_SLEEPER_BERTH_PILOT';
      readonly source: string;
      readonly explanation: string;
    }[];
  }> = {},
): ReturnType<typeof calculateHosAdvancedRules> {
  const coreResult = calculateHosCore({ departureState: departure, dutyEvents });
  return calculateHosAdvancedRules({
    departureState: departure,
    historicalDutyEvents: [],
    dutyEvents,
    coreResult,
    ...options,
  });
}

describe('Stage 08 master HOS acceptance scenarios', () => {
  it('HOS-01 completes a one-day trip with fresh 11/14/70 clocks', () => {
    const departure = departureState();
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [
        dutyEvent({
          id: 'hos-01-drive-eight',
          startAt: departure.departureAt,
          minutes: 480,
          dutyStatus: 'DRIVING',
        }),
        dutyEvent({
          id: 'hos-01-break-thirty',
          startAt: addMinutes(departure.departureAt, 480),
          minutes: 30,
          dutyStatus: 'OFF_DUTY',
        }),
        dutyEvent({
          id: 'hos-01-drive-three',
          startAt: addMinutes(departure.departureAt, 510),
          minutes: 180,
          dutyStatus: 'DRIVING',
        }),
      ],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.final.drivingTimeRemaining.value).toBe(0);
    expect(result.final.shiftTimeRemaining.value).toBe(150);
    expect(result.final.cycleTimeRemaining.value).toBe(3540);
  });

  it('HOS-02 stops at the shift clock when more driving time remains', () => {
    const departure = departureState({
      drivingTimeRemaining: { value: 600, unit: 'minute' },
      shiftTimeRemaining: { value: 300, unit: 'minute' },
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-02-shift-limited-drive',
        startAt: departure.departureAt,
        minutes: 301,
        dutyStatus: 'DRIVING',
      })],
    });

    expect(result.transitions[0]?.legalDrivingTime.value).toBe(300);
    expect(result.transitions[0]?.prohibitedDrivingTime.value).toBe(1);
    expect(result.violations[0]?.eventId).toBe('hos-02-shift-limited-drive');
    expect(violationCodes(result)).toContain('SHIFT_WINDOW_EXCEEDED');
  });

  it('HOS-03 stops at the cycle clock when more shift time remains', () => {
    const departure = departureState({
      shiftTimeRemaining: { value: 600, unit: 'minute' },
      cycleTimeRemaining: { value: 60, unit: 'minute' },
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-03-cycle-limited-drive',
        startAt: departure.departureAt,
        minutes: 61,
        dutyStatus: 'DRIVING',
      })],
    });

    expect(result.transitions[0]?.legalDrivingTime.value).toBe(60);
    expect(result.violations.find(
      (violation) => violation.code === 'CYCLE_LIMIT_EXCEEDED',
    )?.occurredAt).toBe(addMinutes(departure.departureAt, 60));
  });

  it('HOS-04 requires a 30-minute interruption at eight cumulative driving hours', () => {
    const departure = departureState();
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-04-drive-eight',
        startAt: departure.departureAt,
        minutes: 480,
        dutyStatus: 'DRIVING',
      })],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.final.canDrive).toBe(false);
    expect(result.nextRequiredAction.code).toBe('TAKE_THIRTY_MINUTE_INTERRUPTION');
  });

  it('HOS-05 accepts a 45-minute on-duty shipper stop as the interruption', () => {
    const departure = departureState({
      drivenSinceLastQualifyingInterruption: { value: 480, unit: 'minute' },
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-05-shipper-stop',
        startAt: departure.departureAt,
        minutes: 45,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'LOADING',
      })],
    });

    expect(result.final.drivenSinceLastQualifyingInterruption.value).toBe(0);
    expect(
      result.transitions[0]?.milestones.qualifyingInterruptionCompletedAt,
    ).toBe(addMinutes(departure.departureAt, 30));
  });

  it('HOS-06 rejects a 20-minute stop as an interruption', () => {
    const departure = departureState({
      drivenSinceLastQualifyingInterruption: { value: 480, unit: 'minute' },
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-06-short-stop',
        startAt: departure.departureAt,
        minutes: 20,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'LOADING',
        qualifiesForThirtyMinuteInterruption: false,
      })],
    });

    expect(result.final.drivenSinceLastQualifyingInterruption.value).toBe(480);
    expect(result.nextRequiredAction.code).toBe('TAKE_THIRTY_MINUTE_INTERRUPTION');
  });

  it('HOS-07 treats fuel as on-duty time that consumes shift and cycle clocks', () => {
    const departure = departureState();
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-07-fuel',
        startAt: departure.departureAt,
        minutes: 30,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'FUEL',
      })],
    });

    expect(result.final.drivingTimeRemaining.value).toBe(660);
    expect(result.final.shiftTimeRemaining.value).toBe(810);
    expect(result.final.cycleTimeRemaining.value).toBe(4170);
  });

  it('HOS-08 requires and applies a 10-hour break before final driving', () => {
    const departure = departureState({
      drivingTimeRemaining: { value: 0, unit: 'minute' },
      shiftTimeRemaining: { value: 0, unit: 'minute' },
      onDutyTimeCurrentShift: { value: 840, unit: 'minute' },
      qualifyingTenHourBreakCompleted: false,
      offDutyTimeImmediatelyBeforeDeparture: { value: 0, unit: 'minute' },
    });
    const rest = dutyEvent({
      id: 'hos-08-reset',
      startAt: departure.departureAt,
      minutes: 600,
      dutyStatus: 'OFF_DUTY',
    });
    const drive = dutyEvent({
      id: 'hos-08-final-drive',
      startAt: rest.endAt,
      minutes: 60,
      dutyStatus: 'DRIVING',
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [rest, drive],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.transitions[0]?.milestones.tenHourResetCompletedAt).toBe(rest.endAt);
    expect(result.final.drivingTimeRemaining.value).toBe(600);
  });

  it('HOS-09 returns recap hours at the configured home-terminal boundary', () => {
    const departure = departureState({
      departureAt: '2026-07-20T12:00:00.000Z',
      currentDutyStatusStartedAt: '2026-07-20T12:00:00.000Z',
      cycleTimeRemaining: { value: 4140, unit: 'minute' },
    });
    const boundary = Object.freeze({
      ...utcRegulatoryBoundary,
      localStartTime: '04:00',
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents: completeHistory(
        '2026-07-13T04:00:00.000Z',
        departure.departureAt,
        [{
          startAt: '2026-07-13T04:00:00.000Z',
          endAt: '2026-07-13T05:00:00.000Z',
        }],
      ),
      dutyEvents: [],
      regulatoryDayBoundary: boundary,
    });
    const recap = result.availabilityEvents.find((event) => event.kind === 'RECAP');

    expect(recap?.sourceDate).toBe('2026-07-13');
    expect(recap?.availableAt).toBe('2026-07-21T04:00:00.000Z');
    expect(recap?.availableTime.value).toBe(60);
  });

  it('HOS-10 applies a valid explicitly selected 7/3 sleeper pair', () => {
    const departure = departureState({ splitSleeperEnabled: true });
    const dutyEvents = [
      dutyEvent({
        id: 'hos-10-drive-one',
        startAt: departure.departureAt,
        minutes: 240,
        dutyStatus: 'DRIVING',
      }),
      dutyEvent({
        id: 'hos-10-short-three',
        startAt: addMinutes(departure.departureAt, 240),
        minutes: 180,
        dutyStatus: 'OFF_DUTY',
        pairId: 'hos-10-pair',
        candidateRole: 'SHORT_PERIOD',
      }),
      dutyEvent({
        id: 'hos-10-drive-two',
        startAt: addMinutes(departure.departureAt, 420),
        minutes: 300,
        dutyStatus: 'DRIVING',
      }),
      dutyEvent({
        id: 'hos-10-long-seven',
        startAt: addMinutes(departure.departureAt, 720),
        minutes: 420,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'hos-10-pair',
        candidateRole: 'LONG_PERIOD',
      }),
    ];
    const result = evaluateAdvanced(departure, dutyEvents, {
      selectedSleeperPairId: 'hos-10-pair',
    });

    expect(result.sleeper.appliedPair?.status).toBe('VALID_SELECTED_AND_APPLIED');
    expect(result.sleeper.appliedPair?.periods.map((period) => period.id)).toEqual([
      'hos-10-short-three',
      'hos-10-long-seven',
    ]);
  });

  it('HOS-11 does not create a split from invalid nine-hour periods', () => {
    const departure = departureState({ splitSleeperEnabled: true });
    const dutyEvents = [
      dutyEvent({
        id: 'hos-11-short-two',
        startAt: departure.departureAt,
        minutes: 120,
        dutyStatus: 'OFF_DUTY',
        pairId: 'hos-11-pair',
        candidateRole: 'SHORT_PERIOD',
      }),
      dutyEvent({
        id: 'hos-11-long-seven',
        startAt: addMinutes(departure.departureAt, 120),
        minutes: 420,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'hos-11-pair',
        candidateRole: 'LONG_PERIOD',
      }),
    ];
    const result = evaluateAdvanced(departure, dutyEvents, {
      selectedSleeperPairId: 'hos-11-pair',
    });

    expect(result.sleeper.appliedPair).toBeUndefined();
    expect(result.sleeper.pairs[0]?.issues.map((issue) => issue.code)).toContain(
      'PAIR_TOTAL_SHORTER_THAN_TEN_HOURS',
    );
  });

  it('HOS-12 applies a planned qualifying 34-hour restart to the cycle', () => {
    const departure = departureState({
      departureAt: '2026-07-20T12:00:00.000Z',
      currentDutyStatusStartedAt: '2026-07-20T12:00:00.000Z',
      cycleTimeRemaining: { value: 0, unit: 'minute' },
      restart34HourPlanned: true,
    });
    const historicalDutyEvents = completeHistory(
      '2026-07-13T00:00:00.000Z',
      departure.departureAt,
      [
        { startAt: '2026-07-17T00:00:00.000Z', endAt: '2026-07-17T23:20:00.000Z' },
        { startAt: '2026-07-18T00:00:00.000Z', endAt: '2026-07-18T23:20:00.000Z' },
        { startAt: '2026-07-19T12:40:00.000Z', endAt: '2026-07-20T12:00:00.000Z' },
      ],
    );
    const rest = dutyEvent({
      id: 'hos-12-restart',
      startAt: departure.departureAt,
      minutes: 2040,
      dutyStatus: 'OFF_DUTY',
    });
    const drive = dutyEvent({
      id: 'hos-12-drive',
      startAt: rest.endAt,
      minutes: 60,
      dutyStatus: 'DRIVING',
    });
    const result = calculateHosCycle({
      departureState: departure,
      historicalDutyEvents,
      dutyEvents: [rest, drive],
      regulatoryDayBoundary: utcRegulatoryBoundary,
    });

    expect(result.availabilityEvents.find(
      (event) => event.kind === 'THIRTY_FOUR_HOUR_RESTART',
    )?.availableAt).toBe(rest.endAt);
    expect(result.violations).toHaveLength(0);
    expect(result.final.cycleTimeRemaining.value).toBe(4140);
  });

  it('HOS-13 leaves adverse mode disabled until explicitly selected', () => {
    const departure = departureState();
    const disabled = evaluateAdvanced(departure, []);
    const applied = evaluateAdvanced(departure, [], {
      adverseDrivingCondition: adverseSelection(120),
    });

    expect(disabled.adverseDrivingCondition.status).toBe('NOT_SELECTED');
    expect(applied.adverseDrivingCondition.status).toBe('APPLIED');
  });

  it('HOS-14 does not pause the 14-hour window during ordinary waiting', () => {
    const departure = departureState();
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: 'hos-14-waiting',
        startAt: departure.departureAt,
        minutes: 120,
        dutyStatus: 'OFF_DUTY',
        eventType: 'BREAK',
      })],
    });

    expect(result.final.shiftTimeRemaining.value).toBe(720);
    expect(result.final.shiftWindowActive).toBe(true);
  });

  it('HOS-15 blocks departure when cycle availability is zero', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 0, unit: 'minute' },
    });
    const result = calculateHosCore({ departureState: departure, dutyEvents: [] });

    expect(result.initial.canDrive).toBe(false);
    expect(result.initial.blockingReasons.map((reason) => reason.code)).toContain(
      'CYCLE_LIMIT_REACHED',
    );
  });
});

describe('Stage 08 exact boundaries and deterministic sequences', () => {
  it.each([
    { minutes: 659, exceeds: false },
    { minutes: 660, exceeds: false },
    { minutes: 661, exceeds: true },
  ])('evaluates driving at $minutes minutes', ({ minutes, exceeds }) => {
    const departure = departureState({
      drivenSinceLastQualifyingInterruption: { value: 0, unit: 'minute' },
    });
    const first = dutyEvent({
      id: `drive-boundary-first-${String(minutes)}`,
      startAt: departure.departureAt,
      minutes: 480,
      dutyStatus: 'DRIVING',
    });
    const breakEvent = dutyEvent({
      id: `drive-boundary-break-${String(minutes)}`,
      startAt: first.endAt,
      minutes: 30,
      dutyStatus: 'OFF_DUTY',
    });
    const last = dutyEvent({
      id: `drive-boundary-last-${String(minutes)}`,
      startAt: breakEvent.endAt,
      minutes: minutes - 480,
      dutyStatus: 'DRIVING',
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [first, breakEvent, last],
    });

    expect(violationCodes(result).includes('DRIVING_LIMIT_EXCEEDED')).toBe(exceeds);
  });

  it.each([
    { minutes: 29, qualifies: false },
    { minutes: 30, qualifies: true },
    { minutes: 31, qualifies: true },
  ])('evaluates interruption duration at $minutes minutes', ({ minutes, qualifies }) => {
    const departure = departureState({
      drivenSinceLastQualifyingInterruption: { value: 480, unit: 'minute' },
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: `interrupt-${String(minutes)}`,
        startAt: departure.departureAt,
        minutes,
        dutyStatus: 'OFF_DUTY',
        qualifiesForThirtyMinuteInterruption: qualifies,
      })],
    });

    expect(result.final.drivenSinceLastQualifyingInterruption.value === 0).toBe(qualifies);
  });

  it.each([
    { minutes: 599, resets: false },
    { minutes: 600, resets: true },
    { minutes: 601, resets: true },
  ])('evaluates the 10-hour reset at $minutes minutes', ({ minutes, resets }) => {
    const departure = departureState({
      drivingTimeRemaining: { value: 0, unit: 'minute' },
      shiftTimeRemaining: { value: 0, unit: 'minute' },
      qualifyingTenHourBreakCompleted: false,
      offDutyTimeImmediatelyBeforeDeparture: { value: 0, unit: 'minute' },
    });
    const result = calculateHosCore({
      departureState: departure,
      dutyEvents: [dutyEvent({
        id: `reset-${String(minutes)}`,
        startAt: departure.departureAt,
        minutes,
        dutyStatus: 'OFF_DUTY',
      })],
    });

    expect(
      result.transitions[0]?.milestones.tenHourResetCompletedAt !== undefined,
    ).toBe(resets);
  });

  it.each([
    { longMinutes: 479, valid: false },
    { longMinutes: 480, valid: true },
    { longMinutes: 481, valid: true },
  ])('evaluates sleeper total with a $longMinutes-minute long period', ({ longMinutes, valid }) => {
    const departure = departureState({ splitSleeperEnabled: true });
    const short = dutyEvent({
      id: `sleeper-short-${String(longMinutes)}`,
      startAt: departure.departureAt,
      minutes: 120,
      dutyStatus: 'OFF_DUTY',
      pairId: 'boundary-sleeper-pair',
      candidateRole: 'SHORT_PERIOD',
    });
    const long = dutyEvent({
      id: `sleeper-long-${String(longMinutes)}`,
      startAt: short.endAt,
      minutes: longMinutes,
      dutyStatus: 'SLEEPER_BERTH',
      pairId: 'boundary-sleeper-pair',
      candidateRole: 'LONG_PERIOD',
    });
    const result = evaluateAdvanced(departure, [short, long], {
      selectedSleeperPairId: 'boundary-sleeper-pair',
    });

    expect(result.sleeper.appliedPair !== undefined).toBe(valid);
  });

  it.each([
    { minutes: 119, applies: true },
    { minutes: 120, applies: true },
    { minutes: 121, applies: false },
  ])('evaluates adverse extension at $minutes minutes', ({ minutes, applies }) => {
    const result = evaluateAdvanced(departureState(), [], {
      adverseDrivingCondition: adverseSelection(minutes),
    });

    expect(result.adverseDrivingCondition.status === 'APPLIED').toBe(applies);
  });

  it('rejects ordering, overlap, gap, and invalid duration evidence with clear paths', () => {
    const first = dutyEvent({
      id: 'sequence-first',
      startAt: '2026-07-20T00:00:00.000Z',
      minutes: 60,
      dutyStatus: 'DRIVING',
    });
    const overlapping = dutyEvent({
      id: 'sequence-overlap',
      startAt: '2026-07-20T00:30:00.000Z',
      minutes: 60,
      dutyStatus: 'DRIVING',
    });
    const gap = dutyEvent({
      id: 'sequence-gap',
      startAt: '2026-07-20T02:00:00.000Z',
      minutes: 60,
      dutyStatus: 'DRIVING',
    });

    expect(() => validateDutyEventHistory([first, overlapping])).toThrow(HosValidationError);
    expect(() => validateDutyEventHistory([first, gap])).toThrow(HosValidationError);
    expect(() => validateDutyEventHistory([gap, first])).toThrow(HosValidationError);
    expect(() => validateDutyEvent({
      ...first,
      duration: { value: 59, unit: 'minute' },
    })).toThrow(HosValidationError);
  });

  it('replays the same validated evidence deterministically', () => {
    const departure = departureState();
    const dutyEvents = [
      dutyEvent({
        id: 'replay-drive',
        startAt: departure.departureAt,
        minutes: 120,
        dutyStatus: 'DRIVING',
      }),
      dutyEvent({
        id: 'replay-fuel',
        startAt: addMinutes(departure.departureAt, 120),
        minutes: 30,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
        eventType: 'FUEL',
      }),
    ];

    const first = calculateHosCore({ departureState: departure, dutyEvents });
    const second = calculateHosCore({ departureState: departure, dutyEvents });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('keeps UTC legal arithmetic identical across display time zones', () => {
    const utcDeparture = departureState({ departureTimeZone: 'UTC' });
    const pacificDeparture = departureState({ departureTimeZone: 'America/Los_Angeles' });
    const utcEvent = dutyEvent({
      id: 'timezone-drive',
      startAt: utcDeparture.departureAt,
      minutes: 60,
      dutyStatus: 'DRIVING',
      locationTimeZone: 'UTC',
    });
    const pacificEvent = dutyEvent({
      id: 'timezone-drive',
      startAt: pacificDeparture.departureAt,
      minutes: 60,
      dutyStatus: 'DRIVING',
      locationTimeZone: 'America/Los_Angeles',
    });

    const utcResult = calculateHosCore({
      departureState: utcDeparture,
      dutyEvents: [utcEvent],
    });
    const pacificResult = calculateHosCore({
      departureState: pacificDeparture,
      dutyEvents: [pacificEvent],
    });

    expect(pacificResult.final.drivingTimeRemaining).toEqual(
      utcResult.final.drivingTimeRemaining,
    );
    expect(pacificResult.final.shiftTimeRemaining).toEqual(
      utcResult.final.shiftTimeRemaining,
    );
    expect(pacificResult.final.cycleTimeRemaining).toEqual(
      utcResult.final.cycleTimeRemaining,
    );
  });

  it('keeps disabled unsupported exceptions blocking and clock-neutral', () => {
    const result = evaluateAdvanced(departureState(), [], {
      unsupportedSpecialRuleSelections: [
        {
          rule: 'PERSONAL_CONVEYANCE',
          source: 'Stage 08 test selection',
          explanation: 'No supported personal-conveyance module exists.',
        },
        {
          rule: 'FLEXIBLE_SLEEPER_BERTH_PILOT',
          source: 'Stage 08 test selection',
          explanation: 'No verified pilot enrollment or production rule module exists.',
        },
      ],
    });

    expect(result.unsupportedRuleWarnings).toHaveLength(2);
    expect(result.clockAlterationBlocked).toBe(true);
    expect(result.adverseDrivingCondition.status).toBe('NOT_SELECTED');
  });
});
